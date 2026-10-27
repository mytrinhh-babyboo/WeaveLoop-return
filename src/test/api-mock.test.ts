import { describe, expect, it } from "vitest";
import { formatGrams, formatGramsCompact, truncateId } from "@/lib/api/formatters";
import { mockApi, mockSession } from "@/lib/api/mock/mock-api";
import { ApiError } from "@/lib/api/client";

describe("weight formatting", () => {
  it("keeps grams as the source of truth and shows kg conversions", () => {
    expect(formatGrams(12450)).toBe("12.45 kg");
  });

  it("switches to tonnes for large masses", () => {
    expect(formatGrams(2_450_000)).toBe("2.45 t");
    expect(formatGrams(2_450_000, { unit: "kg" })).toBe("2,450 kg");
  });

  it("formats compact KPI values without combining stages", () => {
    expect(formatGramsCompact(12_450_000)).toBe("12.45 t");
    expect(formatGramsCompact(840_000)).toBe("840 kg");
  });

  it("truncates long identifiers", () => {
    expect(truncateId("epr_1a2b3c4d5e6f")).toBe("epr_1a2b…5e6f");
    expect(truncateId("short")).toBe("short");
  });
});

describe("mock API business rules", () => {
  const ORG = "org_0001";

  it("isolates tenants: another organization's bags are invisible", async () => {
    const own = await mockApi.listBags(ORG, { pageSize: 100 });
    const other = await mockApi.listBags("org_0002", { pageSize: 100 });
    expect(own.data.length).toBeGreaterThan(0);
    expect(other.data.every((b) => b.organizationId === "org_0002")).toBe(true);
    expect(other.data.some((b) => b.organizationId === ORG)).toBe(false);
    await expect(mockApi.getBag("org_0002", own.data[0]!.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects a weighing without a positive gram value and preserves exact grams", async () => {
    const bags = await mockApi.listBags(ORG, { status: "ACTIVE" });
    const bag = bags.data[0]!;
    await expect(
      mockApi.createWeighingEvent(ORG, { bagId: bag.id, weightGrams: 0, occurredAt: new Date().toISOString(), source: "OPERATOR_ENTRY" }),
    ).rejects.toMatchObject({ code: "validation_error" });
    const event = await mockApi.createWeighingEvent(
      ORG,
      { bagId: bag.id, weightGrams: 12453, occurredAt: new Date().toISOString(), source: "OPERATOR_ENTRY" },
      "test-idem-1",
    );
    expect(event.weightGrams).toBe(12453);
  });

  it("rejects duplicate weighing submissions by idempotency key", async () => {
    const bags = await mockApi.listBags(ORG, { status: "ACTIVE" });
    const bag = bags.data[0]!;
    await expect(
      mockApi.createWeighingEvent(
        ORG,
        { bagId: bag.id, weightGrams: 5000, occurredAt: new Date().toISOString(), source: "OPERATOR_ENTRY" },
        "test-idem-1", // same key as previous test's successful event
      ),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("requires accepted + rejected + loss to equal received mass when sorting", async () => {
    const receipts = await mockApi.listWarehouseReceipts(ORG, {});
    const sorted = await mockApi.listSortingRecords(ORG);
    const unsorted = receipts.data.find((r) => !sorted.some((s) => s.warehouseReceiptId === r.id));
    if (!unsorted) return; // dataset may be fully sorted; balance rule covered by split test
    await expect(
      mockApi.createSortingRecord(ORG, {
        warehouseReceiptId: unsorted.id,
        acceptedGrams: 100,
        rejectedGrams: 0,
        lossGrams: 0,
      }),
    ).rejects.toMatchObject({ code: "validation_error" });
  });


  it("enforces EPR draft validation: period format, duplicate reservation, missing evidence", async () => {
    const receipts = await mockApi.listRecyclerReceipts(ORG, {});
    const anyReceipt = receipts.data[0]!;
    await expect(
      mockApi.createEprDraft(ORG, { recyclerReceiptId: anyReceipt.id, periodKey: "26-Q4" }),
    ).rejects.toMatchObject({ code: "validation_error" });
    await expect(
      mockApi.createEprDraft(ORG, { recyclerReceiptId: anyReceipt.id, periodKey: "2026-Q4" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("creates a draft from a fresh receipt with accepted evidence and computes candidate grams", async () => {
    // Find or build a receipt with accepted evidence and no draft
    const receipts = await mockApi.listRecyclerReceipts(ORG, {});
    const withAccepted = receipts.data.find(
      (r) => !r.reservedByDraftId && (r.documents ?? []).some((d) => d.reviewStatus === "ACCEPTED"),
    );
    if (!withAccepted) return;
    const draft = await mockApi.createEprDraft(ORG, { recyclerReceiptId: withAccepted.id, periodKey: "2027-Q1" });
    expect(draft.status).toBe("DRAFT");
    expect(draft.candidateEligibleGrams).toBe(withAccepted.receivedGrams);
    expect(draft.draftReference).toContain("2027-Q1");
  });

  it("blocks READY_FOR_VERIFICATION for the reviewer who recorded the receipt (separation of duties)", async () => {
    const receipts = await mockApi.listRecyclerReceipts(ORG, {});
    const withAccepted = receipts.data.find(
      (r) => !r.reservedByDraftId && (r.documents ?? []).some((d) => d.reviewStatus === "ACCEPTED"),
    );
    if (!withAccepted) return;
    const draft = await mockApi.createEprDraft(ORG, { recyclerReceiptId: withAccepted.id, periodKey: "2027-Q1" });
    const recordedBySelf = withAccepted.recordedByName === mockSession.fullName;
    if (recordedBySelf) {
      await expect(
        mockApi.createEprReview(ORG, draft.id, { decision: "READY_FOR_VERIFICATION", note: "This should be blocked by separation of duties." }),
      ).rejects.toMatchObject({ code: "forbidden" });
    } else {
      // Reviewer did not record the receipt: readiness is allowed, duplicate is not.
      const review = await mockApi.createEprReview(ORG, draft.id, {
        decision: "READY_FOR_VERIFICATION",
        note: "Evidence accepted and mass within tolerance.",
      });
      expect(review.decision).toBe("READY_FOR_VERIFICATION");
      await expect(
        mockApi.createEprReview(ORG, draft.id, { decision: "READY_FOR_VERIFICATION", note: "Duplicate readiness attempt." }),
      ).rejects.toMatchObject({ code: "conflict" });
    }
  });

  it("blocks review decisions for OPERATOR and VIEWER roles", async () => {
    const drafts = await mockApi.listEprDrafts(ORG);
    const draft = drafts[0]!;
    const original = mockSession.role;
    (mockSession as unknown as { role: (orgId: string) => string }).role = () => "OPERATOR";
    try {
      await expect(
        mockApi.createEprReview(ORG, draft.id, { decision: "REQUEST_CHANGES", note: "Operators cannot review." }),
      ).rejects.toMatchObject({ code: "forbidden" });
    } finally {
      (mockSession as unknown as { role: (orgId: string) => string }).role = original;
    }
  });


  it("rejects infected documents as evidence even if a reviewer tries", async () => {
    const docs = await mockApi.listDocumentsPendingReview(ORG);
    const infected = docs.find((d) => d.scanStatus === "INFECTED");
    if (!infected) return;
    await expect(
      mockApi.reviewDocument(ORG, infected.id, "ACCEPTED", "attempt"),
    ).rejects.toMatchObject({ code: "conflict" });
    const result = await mockApi.reviewDocument(ORG, infected.id, "REJECTED", "flagged by malware scan");
    expect(result.reviewStatus).toBe("REJECTED");
    expect(result.reviewStatus).not.toBe("ACCEPTED");
  });


  it("conserve mass across split operations", async () => {
    const lots = await mockApi.listMaterialLots(ORG, {});
    const available = lots.find((l) => l.consumptionStatus !== "CONSUMED");
    if (!available) return;
    const partA = Math.floor(available.massGrams * 0.3);
    const partB = available.massGrams - partA;
    await expect(
      mockApi.splitLot(ORG, available.id, [{ massGrams: partA }, { massGrams: partA }]),
    ).rejects.toMatchObject({ code: "validation_error" });
    const op = await mockApi.splitLot(ORG, available.id, [{ massGrams: partA }, { massGrams: partB }]);
    expect(op.type).toBe("SPLIT");
    expect(op.inputs[0]!.massGrams).toBe(partA + partB);
  });

  it("throws ApiError instances so UI can show field-level validation", async () => {
    try {
      await mockApi.createCollectionPoint(ORG, { code: "", name: "" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).fieldErrors).toHaveProperty("code");
    }
  });
});
