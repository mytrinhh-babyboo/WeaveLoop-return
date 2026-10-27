/**
 * Mock API implementation.
 *
 * Mirrors the documented NestJS contract (Master Prompt §8–§14). Every service
 * method has a mock twin here; when VITE_USE_MOCK_API is true the service
 * layer routes to these instead of HTTP. Mutations mutate the in-memory demo
 * store so the whole platform is browsable and interactive end-to-end.
 *
 * Validation rules implemented here mirror the backend rules stated in the
 * Master Prompt (idempotency, separation of duties, reserved receipts, etc.)
 * so the UI exercises the same error paths as production.
 */
import { ApiError } from "../client";
import { getDemoStore, type DemoStore } from "./seed";
import type {
  ActionItem,
  BagStatus,
  CollectionBag,
  CollectionPoint,
  CollectionVolumePoint,
  CustodyStatus,
  CustodyTransfer,
  DashboardKpis,
  EprDraft,
  EprDraftReview,
  EprReviewDecision,
  LotOperation,
  MaterialLot,
  Membership,
  Paginated,
  Partner,
  RecyclerDocument,
  RecyclerReceipt,
  ReviewStatus,
  Role,
  SortingRecord,
  WarehouseReceipt,
  WeighingEvent,
} from "../types";

const DELAY = 220;
const delay = (ms = DELAY) => new Promise<void>((r) => setTimeout(r, ms));

function paginate<T>(items: T[], page: number, pageSize: number): Paginated<T> {
  const total = items.length;
  const start = (page - 1) * pageSize;
  return { data: items.slice(start, start + pageSize), meta: { total, page, pageSize } };
}

function matches(text: string | undefined, search: string): boolean {
  return (text ?? "").toLowerCase().includes(search.toLowerCase());
}

function conflicts(message: string): never {
  throw new ApiError(409, "conflict", message);
}

function notFound(message: string): never {
  throw new ApiError(404, "not_found", message);
}

function forbidden(message: string): never {
  throw new ApiError(403, "forbidden", message);
}

const WRITE_ROLES: Role[] = ["OWNER", "ADMIN", "OPERATOR"];
const REVIEW_ROLES: Role[] = ["OWNER", "ADMIN", "AUDITOR"];

function assertCanWrite(role: Role): void {
  if (!WRITE_ROLES.includes(role)) {
    forbidden(`Your role (${role}) is not permitted to modify operational records. Required: OWNER, ADMIN or OPERATOR.`);
  }
}

function assertCanReview(role: Role): void {
  if (!REVIEW_ROLES.includes(role)) {
    forbidden(`Your role (${role}) cannot record review decisions. Required: OWNER, ADMIN or AUDITOR.`);
  }
}

/** Mock "current user" — replaced by the real session once connected. */
export const mockSession = {
  userId: "user_demo",
  fullName: "Trịnh Mỹ Linh",
  email: "mylinh@weaveloop.example",
  activeOrgId: "org_0001",
  role: (orgId: string): Role =>
    ({
      org_0001: "ADMIN" as Role,
      org_0002: "OPERATOR" as Role,
    })[orgId] ?? "VIEWER",
};

function withinRange(isoDate: string, from?: string, to?: string): boolean {
  const t = new Date(isoDate).getTime();
  if (from && t < new Date(`${from}T00:00:00Z`).getTime()) return false;
  if (to && t > new Date(`${to}T23:59:59Z`).getTime()) return false;
  return true;
}

export const mockApi = {
  // ============================ Auth & Organizations =======================
  async listMemberships(): Promise<Membership[]> {
    await delay();
    return getDemoStore().then((s) => s.memberships);
  },

  async listPartners(organizationId: string, params: { type?: Partner["type"]; search?: string }): Promise<Partner[]> {
    await delay();
    const store = await getDemoStore();
    return store.partners
      .filter((p) => p.organizationId === organizationId)
      .filter((p) => (params.type ? p.type === params.type : true))
      .filter((p) => (params.search ? matches(p.name, params.search) : true));
  },

  // ============================ Collection Points ==========================
  async listCollectionPoints(
    organizationId: string,
    params: { search?: string; status?: string; partnerId?: string; page?: number; pageSize?: number },
  ): Promise<Paginated<CollectionPoint>> {
    await delay();
    const store = await getDemoStore();
    const rows = store.collectionPoints
      .filter((cp) => cp.organizationId === organizationId)
      .filter((cp) => (params.status ? cp.status === params.status : true))
      .filter((cp) => (params.partnerId ? cp.partnerId === params.partnerId : true))
      .filter((cp) => (params.search ? matches(cp.name, params.search) || matches(cp.code, params.search) : true))
      .map((cp) => ({
        ...cp,
        bagCount: store.bags.filter((b) => b.collectionPointId === cp.id).length,
      }));
    return paginate(rows, params.page ?? 1, params.pageSize ?? 10);
  },

  async createCollectionPoint(
    organizationId: string,
    input: { code: string; name: string; partnerId?: string; address?: string; city?: string },
  ): Promise<CollectionPoint> {
    await delay();
    assertCanWrite(mockSession.role(organizationId));
    const store = await getDemoStore();
    if (store.collectionPoints.some((cp) => cp.organizationId === organizationId && cp.code === input.code)) {
      conflicts(`A collection point with code ${input.code} already exists in this organization.`);
    }
    if (!input.code?.trim() || !input.name?.trim()) {
      throw new ApiError(400, "validation_error", "Code and name are required.", {
        code: input.code?.trim() ? "" : "Collection point code is required.",
        name: input.name?.trim() ? "" : "Collection point name is required.",
      });
    }
    const partner = store.partners.find((p) => p.id === input.partnerId && p.organizationId === organizationId);
    const cp: CollectionPoint = {
      id: `cp_${crypto.randomUUID().slice(0, 8)}`,
      organizationId,
      partnerId: partner?.id,
      partner,
      code: input.code.trim(),
      name: input.name.trim(),
      address: input.address?.trim() || undefined,
      city: input.city?.trim() || partner?.city,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    };
    store.collectionPoints.push(cp);
    return cp;
  },

  // ============================ Collection Bags ============================
  async listBags(
    organizationId: string,
    params: { search?: string; status?: BagStatus; collectionPointId?: string; page?: number; pageSize?: number },
  ): Promise<Paginated<CollectionBag>> {
    await delay();
    const store = await getDemoStore();
    const rows = store.bags
      .filter((b) => b.organizationId === organizationId)
      .filter((b) => (params.status ? b.status === params.status : true))
      .filter((b) => (params.collectionPointId ? b.collectionPointId === params.collectionPointId : true))
      .filter((b) => (params.search ? matches(b.code, params.search) || matches(b.collectionPoint?.name, params.search) : true))
      .sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));
    return paginate(rows, params.page ?? 1, params.pageSize ?? 10);
  },

  async getBag(organizationId: string, bagId: string): Promise<CollectionBag> {
    await delay();
    const store = await getDemoStore();
    return store.bags.find((b) => b.id === bagId && b.organizationId === organizationId) ?? notFound("Collection bag not found in this organization.");
  },

  async issueBag(organizationId: string, input: { collectionPointId: string }): Promise<CollectionBag> {
    await delay();
    assertCanWrite(mockSession.role(organizationId));
    const store = await getDemoStore();
    const cp = store.collectionPoints.find((c) => c.id === input.collectionPointId && c.organizationId === organizationId);
    if (!cp) notFound("Collection point not found in this organization.");
    const seq = store.bags.filter((b) => b.collectionPointId === cp.id).length + 1;
    const bag: CollectionBag = {
      id: `bag_${crypto.randomUUID().slice(0, 8)}`,
      organizationId,
      collectionPointId: cp.id,
      collectionPoint: cp,
      code: `BAG-${cp.code.replace("CP-", "")}-${String(seq).padStart(3, "0")}`,
      status: "ISSUED",
      issuedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    store.bags.push(bag);
    return bag;
  },

  async lookupBagByCode(organizationId: string, code: string): Promise<CollectionBag> {
    await delay();
    const store = await getDemoStore();
    const bag = store.bags.find(
      (b) => b.organizationId === organizationId && b.code.toLowerCase() === code.trim().toLowerCase(),
    );
    if (!bag) notFound(`No bag found for code "${code}".`);
    return bag;
  },

  // ============================ Weighing ===================================
  async listWeighingEvents(
    organizationId: string,
    params: { bagId?: string; from?: string; to?: string; page?: number; pageSize?: number },
  ): Promise<Paginated<WeighingEvent>> {
    await delay();
    const store = await getDemoStore();
    const rows = store.weighingEvents
      .filter((w) => w.organizationId === organizationId)
      .filter((w) => (params.bagId ? w.bagId === params.bagId : true))
      .filter((w) => withinRange(w.occurredAt, params.from, params.to))
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
    return paginate(rows, params.page ?? 1, params.pageSize ?? 10);
  },

  async createWeighingEvent(
    organizationId: string,
    input: { bagId: string; weightGrams: number; occurredAt: string; source: WeighingEvent["source"]; notes?: string },
    idempotencyKey?: string,
  ): Promise<WeighingEvent> {
    await delay();
    assertCanWrite(mockSession.role(organizationId));
    const store = await getDemoStore();
    if (idempotencyKey && store.weighingEvents.some((w) => (w as WeighingEvent & { idemKey?: string }).idemKey === idempotencyKey)) {
      conflicts("This weighing event was already recorded (duplicate idempotency key).");
    }
    if (!Number.isFinite(input.weightGrams) || input.weightGrams <= 0) {
      throw new ApiError(400, "validation_error", "Weight must be a positive number of grams.", {
        weightGrams: "Enter a weight greater than 0.",
      });
    }
    if (input.weightGrams > 500_000) {
      throw new ApiError(400, "validation_error", "Single-bag weighing above 500 kg requires supervisor review.", {
        weightGrams: "Value exceeds the per-bag limit (500 kg).",
      });
    }
    const bag = store.bags.find((b) => b.id === input.bagId && b.organizationId === organizationId);
    if (!bag) notFound("Collection bag not found in this organization.");
    if (bag.status === "ISSUED") {
      conflicts("Bag has not been activated yet. Activate the bag before recording weighings.");
    }
    const event: WeighingEvent & { idemKey?: string | undefined } = {
      id: `we_${crypto.randomUUID().slice(0, 8)}`,
      organizationId,
      bagId: bag.id,
      bag,
      weightGrams: Math.round(input.weightGrams),
      actorName: mockSession.fullName,
      occurredAt: input.occurredAt,
      recordedAt: new Date().toISOString(),
      source: input.source,
      notes: input.notes?.trim() || undefined,
      createdAt: new Date().toISOString(),
      idemKey: idempotencyKey,
    };

    store.weighingEvents.push(event);
    return event;
  },

  // ============================ Custody transfers ==========================
  async listCustodyTransfers(
    organizationId: string,
    params: { status?: CustodyStatus; search?: string; page?: number; pageSize?: number },
  ): Promise<Paginated<CustodyTransfer>> {
    await delay();
    const store = await getDemoStore();
    const rows = store.custodyTransfers
      .filter((t) => t.organizationId === organizationId)
      .filter((t) => (params.status ? t.status === params.status : true))
      .filter((t) => (params.search ? matches(t.bag?.code, params.search) || matches(t.toHolderName, params.search) : true))
      .sort((a, b) => (a.initiatedAt < b.initiatedAt ? 1 : -1));
    return paginate(rows, params.page ?? 1, params.pageSize ?? 10);
  },

  async createCustodyTransfer(
    organizationId: string,
    input: { bagId: string; toHolderName: string; note?: string },
  ): Promise<CustodyTransfer> {
    await delay();
    assertCanWrite(mockSession.role(organizationId));
    const store = await getDemoStore();
    const bag = store.bags.find((b) => b.id === input.bagId && b.organizationId === organizationId);
    if (!bag) notFound("Collection bag not found in this organization.");
    const existing = store.custodyTransfers.find((t) => t.bagId === bag.id && t.status === "PENDING");
    if (existing) conflicts(`Bag ${bag.code} already has a pending custody transfer awaiting acknowledgment.`);
    if (!input.toHolderName?.trim()) {
      throw new ApiError(400, "validation_error", "Receiving holder is required.", { toHolderName: "Name the receiving holder." });
    }
    const transfer: CustodyTransfer = {
      id: `ct_${crypto.randomUUID().slice(0, 8)}`,
      organizationId,
      bagId: bag.id,
      bag,
      fromHolderName: bag.collectionPoint?.name ?? "Collection point",
      toHolderName: input.toHolderName.trim(),
      status: "PENDING",
      initiatedByName: mockSession.fullName,
      initiatedAt: new Date().toISOString(),
      note: input.note?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    store.custodyTransfers.push(transfer);
    return transfer;
  },

  async acknowledgeCustodyTransfer(
    organizationId: string,
    transferId: string,
    decision: Extract<CustodyStatus, "ACCEPTED" | "REJECTED">,
    note?: string,
  ): Promise<CustodyTransfer> {
    await delay();
    assertCanWrite(mockSession.role(organizationId));
    const store = await getDemoStore();
    const transfer = store.custodyTransfers.find((t) => t.id === transferId && t.organizationId === organizationId);
    if (!transfer) notFound("Custody transfer not found in this organization.");
    if (transfer.status !== "PENDING") conflicts(`Transfer is already ${transfer.status.toLowerCase()} and cannot be re-acknowledged.`);
    transfer.status = decision;
    transfer.acknowledgedAt = new Date().toISOString();
    transfer.acknowledgedByName = mockSession.fullName;
    if (note?.trim()) transfer.note = note.trim();
    return transfer;
  },

  // ============================ Warehouse & sorting ========================
  async listWarehouseReceipts(
    organizationId: string,
    params: { search?: string; page?: number; pageSize?: number },
  ): Promise<Paginated<WarehouseReceipt>> {
    await delay();
    const store = await getDemoStore();
    const rows = store.warehouseReceipts
      .filter((r) => r.organizationId === organizationId)
      .filter((r) => (params.search ? matches(r.bag?.code, params.search) : true))
      .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
    return paginate(rows, params.page ?? 1, params.pageSize ?? 10);
  },

  async createWarehouseReceipt(
    organizationId: string,
    input: { bagId: string; receivedGrams: number; receivedAt: string; notes?: string },
    idempotencyKey?: string,
  ): Promise<WarehouseReceipt> {
    await delay();
    assertCanWrite(mockSession.role(organizationId));
    const store = await getDemoStore();
    if (idempotencyKey && store.warehouseReceipts.some((r) => r.idempotencyKey === idempotencyKey)) {
      conflicts("A warehouse receipt with this idempotency key already exists.");
    }
    const bag = store.bags.find((b) => b.id === input.bagId && b.organizationId === organizationId);
    if (!bag) notFound("Collection bag not found in this organization.");
    if (store.warehouseReceipts.some((r) => r.bagId === bag.id)) {
      conflicts(`Bag ${bag.code} already has a warehouse receipt. One receipt per bag.`);
    }
    if (!Number.isFinite(input.receivedGrams) || input.receivedGrams <= 0) {
      throw new ApiError(400, "validation_error", "Received weight must be positive.", {
        receivedGrams: "Enter the received weight in grams.",
      });
    }
    const transfer = store.custodyTransfers.find((t) => t.bagId === bag.id);
    if (!transfer || transfer.status !== "ACCEPTED") {
      conflicts("Custody transfer for this bag must be accepted before warehouse intake.");
    }
    const receipt: WarehouseReceipt = {
      id: `wr_${crypto.randomUUID().slice(0, 8)}`,
      organizationId,
      bagId: bag.id,
      bag,
      receivedGrams: Math.round(input.receivedGrams),
      receivedAt: input.receivedAt,
      recordedByName: mockSession.fullName,
      idempotencyKey,
      notes: input.notes?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    store.warehouseReceipts.push(receipt);
    return receipt;
  },

  async listSortingRecords(organizationId: string): Promise<SortingRecord[]> {
    await delay();
    const store = await getDemoStore();
    return store.sortingRecords
      .filter((s) => s.organizationId === organizationId)
      .sort((a, b) => (a.sortedAt < b.sortedAt ? 1 : -1));
  },

  async createSortingRecord(
    organizationId: string,
    input: { warehouseReceiptId: string; acceptedGrams: number; rejectedGrams: number; lossGrams: number; materialType?: string },
  ): Promise<SortingRecord> {
    await delay();
    assertCanWrite(mockSession.role(organizationId));
    const store = await getDemoStore();
    const receipt = store.warehouseReceipts.find((r) => r.id === input.warehouseReceiptId && r.organizationId === organizationId);
    if (!receipt) notFound("Warehouse receipt not found in this organization.");
    if (store.sortingRecords.some((s) => s.warehouseReceiptId === receipt.id)) {
      conflicts("A sorting record already exists for this warehouse receipt.");
    }
    const total = input.acceptedGrams + input.rejectedGrams + input.lossGrams;
    if (total !== receipt.receivedGrams) {
      throw new ApiError(400, "validation_error", "Accepted + rejected + loss must equal the received mass.", {
        lossGrams: `Balance error: received ${receipt.receivedGrams} g, allocated ${total} g. Missing ${receipt.receivedGrams - total} g.`,
      });
    }
    const record: SortingRecord = {
      id: `sr_${crypto.randomUUID().slice(0, 8)}`,
      organizationId,
      warehouseReceiptId: receipt.id,
      warehouseReceipt: receipt,
      acceptedGrams: Math.round(input.acceptedGrams),
      rejectedGrams: Math.round(input.rejectedGrams),
      lossGrams: Math.round(input.lossGrams),
      sortedAt: new Date().toISOString(),
      sortedByName: mockSession.fullName,
      materialType: input.materialType?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    store.sortingRecords.push(record);
    const lot: MaterialLot = {
      id: `lot_${crypto.randomUUID().slice(0, 8)}`,
      organizationId,
      code: `LOT-SGN-${String(store.materialLots.length + 1).padStart(3, "0")}`,
      massGrams: record.acceptedGrams,
      consumedGrams: 0,
      sourceType: "SORTING",
      sourceSortingRecordId: record.id,
      consumptionStatus: "AVAILABLE",
      createdAt: record.sortedAt,
    };
    store.materialLots.push(lot);
    return record;
  },

  // ============================ Material lots ==============================
  async listMaterialLots(organizationId: string, params: { search?: string; status?: string }): Promise<MaterialLot[]> {
    await delay();
    const store = await getDemoStore();
    return store.materialLots
      .filter((l) => l.organizationId === organizationId)
      .filter((l) => (params.status ? l.consumptionStatus === params.status : true))
      .filter((l) => (params.search ? matches(l.code, params.search) : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async getLotLineage(organizationId: string, lotId: string): Promise<{ lot: MaterialLot; operations: LotOperation[] }> {
    await delay();
    const store = await getDemoStore();
    const lot = store.materialLots.find((l) => l.id === lotId && l.organizationId === organizationId) ?? notFound("Material lot not found in this organization.");
    // Ancestor closure: walk every operation whose output is (transitively) this lot.
    const operations: LotOperation[] = [];
    let frontier: string[] = [lot.id];
    let guard = 0;
    while (frontier.length && guard++ < 50) {
      const ops = store.lotOperations.filter((op) => frontier.includes(op.outputLotId));
      if (!ops.length) break;
      operations.push(...ops);
      frontier = ops.flatMap((op) => op.inputs.map((i) => i.lotId));
    }
    return { lot, operations };
  },

  async splitLot(organizationId: string, lotId: string, parts: Array<{ code?: string; massGrams: number }>): Promise<LotOperation> {
    await delay();
    assertCanWrite(mockSession.role(organizationId));
    const store = await getDemoStore();
    const lot = store.materialLots.find((l) => l.id === lotId && l.organizationId === organizationId);
    if (!lot) notFound("Material lot not found in this organization.");
    if (lot.consumptionStatus === "CONSUMED") conflicts(`Lot ${lot.code} is fully consumed and cannot be split.`);
    const total = parts.reduce((s, p) => s + p.massGrams, 0);
    if (total !== lot.massGrams) {
      throw new ApiError(400, "validation_error", "Split parts must conserve the lot mass.", {
        massGrams: `Source lot holds ${lot.massGrams} g; split parts total ${total} g.`,
      });
    }
    const outputs: MaterialLot[] = parts.map((p) => ({
      id: `lot_${crypto.randomUUID().slice(0, 8)}`,
      organizationId,
      code: p.code?.trim() || `LOT-SGN-${String(store.materialLots.length + 1).padStart(3, "0")}`,
      massGrams: Math.round(p.massGrams),
      consumedGrams: 0,
      sourceType: "SPLIT",
      consumptionStatus: "AVAILABLE",
      createdAt: new Date().toISOString(),
    }));
    store.materialLots.push(...outputs);
    lot.consumptionStatus = "CONSUMED";
    lot.consumedGrams = lot.massGrams;
    const op: LotOperation = {
      id: `lo_${crypto.randomUUID().slice(0, 8)}`,
      organizationId,
      type: "SPLIT",
      outputLotId: outputs[0]!.id,
      inputs: [{ lotId: lot.id, lotCode: lot.code, massGrams: lot.massGrams }],
      performedByName: mockSession.fullName,
      performedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    store.lotOperations.push(op);
    // Track remaining outputs so lineage can walk the full split.
    (op as LotOperation & { outputLotIds?: string[] }).outputLotIds = outputs.map((o) => o.id);
    return op;
  },

  async mergeLots(organizationId: string, inputLotIds: string[]): Promise<LotOperation> {
    await delay();
    assertCanWrite(mockSession.role(organizationId));
    const store = await getDemoStore();
    const lots = inputLotIds.map((id) =>
      store.materialLots.find((l) => l.id === id && l.organizationId === organizationId) ?? notFound("Material lot not found in this organization."),
    );
    if (lots.length < 2) throw new ApiError(400, "validation_error", "Select at least two lots to merge.");
    const consumed = lots.find((l) => l.consumptionStatus === "CONSUMED");
    if (consumed) conflicts(`Lot ${consumed.code} is already consumed and cannot be merged.`);
    const output: MaterialLot = {
      id: `lot_${crypto.randomUUID().slice(0, 8)}`,
      organizationId,
      code: `LOT-SGN-${String(store.materialLots.length + 1).padStart(3, "0")}`,
      massGrams: lots.reduce((s, l) => s + l.massGrams, 0),
      consumedGrams: 0,
      sourceType: "MERGE",
      consumptionStatus: "AVAILABLE",
      createdAt: new Date().toISOString(),
    };
    store.materialLots.push(output);
    for (const lot of lots) {
      lot.consumptionStatus = "CONSUMED";
      lot.consumedGrams = lot.massGrams;
    }
    const op: LotOperation = {
      id: `lo_${crypto.randomUUID().slice(0, 8)}`,
      organizationId,
      type: "MERGE",
      outputLotId: output.id,
      inputs: lots.map((l) => ({ lotId: l.id, lotCode: l.code, massGrams: l.massGrams })),
      performedByName: mockSession.fullName,
      performedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    store.lotOperations.push(op);
    return op;
  },

  // ============================ Recycler receipts ==========================
  async listRecyclerReceipts(organizationId: string, params: { search?: string; page?: number; pageSize?: number }): Promise<Paginated<RecyclerReceipt>> {
    await delay();
    const store = await getDemoStore();
    const rows = store.recyclerReceipts
      .filter((r) => r.organizationId === organizationId)
      .filter((r) => (params.search ? matches(r.reference, params.search) || matches(r.recyclerPartner?.name, params.search) : true))
      .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))
      .map((r) => ({
        ...r,
        documents: r.documents?.map((d) => d),
        reservedByDraftId: store.eprDrafts.find((d) => d.recyclerReceiptId === r.id)?.id,
      }));
    return paginate(rows, params.page ?? 1, params.pageSize ?? 10);
  },

  async createRecyclerReceipt(
    organizationId: string,
    input: { sourceMaterialLotId: string; recyclerPartnerId: string; receivedGrams: number; receivedAt: string },
  ): Promise<RecyclerReceipt> {
    await delay();
    assertCanWrite(mockSession.role(organizationId));
    const store = await getDemoStore();
    const lot = store.materialLots.find((l) => l.id === input.sourceMaterialLotId && l.organizationId === organizationId);
    if (!lot) notFound("Material lot not found in this organization.");
    if (store.recyclerReceipts.some((r) => r.sourceMaterialLotId === lot.id)) {
      conflicts(`Lot ${lot.code} already has a recycler receipt.`);
    }
    const partner = store.partners.find((p) => p.id === input.recyclerPartnerId && p.type === "RECYCLER");
    if (!partner) throw new ApiError(400, "validation_error", "Select a recycler partner.", { recyclerPartnerId: "Choose a registered recycler." });
    if (input.receivedGrams > lot.massGrams) {
      throw new ApiError(400, "validation_error", `Received mass exceeds the source lot mass (${lot.massGrams} g).`, {
        receivedGrams: "Cannot exceed the material lot mass.",
      });
    }
    const receipt: RecyclerReceipt = {
      id: `rr_${crypto.randomUUID().slice(0, 8)}`,
      organizationId,
      reference: `RR-${new Date().getFullYear()}-${String(store.recyclerReceipts.length + 1).padStart(4, "0")}`,
      recyclerPartnerId: partner.id,
      recyclerPartner: partner,
      sourceMaterialLotId: lot.id,
      sourceMaterialLot: lot,
      receivedGrams: Math.round(input.receivedGrams),
      receivedAt: input.receivedAt,
      recordedByName: mockSession.fullName,
      documents: [],
      evidence: [],
      createdAt: new Date().toISOString(),
    };
    store.recyclerReceipts.push(receipt);
    lot.consumptionStatus = "CONSUMED";
    lot.consumedGrams = lot.massGrams;
    lot.recyclerReceiptId = receipt.id;
    return receipt;
  },

  async linkEvidence(organizationId: string, receiptId: string, evidenceId: string): Promise<RecyclerReceipt> {
    await delay();
    assertCanWrite(mockSession.role(organizationId));
    const store = await getDemoStore();
    const receipt = store.recyclerReceipts.find((r) => r.id === receiptId && r.organizationId === organizationId) ?? notFound("Recycler receipt not found.");
    const item = store.evidence.find((e) => e.id === evidenceId && e.linkableToReceipt);
    if (!item) notFound("Evidence record not found or not linkable.");
    receipt.evidence = [...(receipt.evidence ?? []), item];
    return receipt;
  },

  async prepareDocument(organizationId: string, receiptId: string, fileName: string): Promise<RecyclerDocument> {
    await delay();
    assertCanWrite(mockSession.role(organizationId));
    const store = await getDemoStore();
    const receipt = store.recyclerReceipts.find((r) => r.id === receiptId && r.organizationId === organizationId) ?? notFound("Recycler receipt not found.");
    if (!fileName.trim()) throw new ApiError(400, "validation_error", "File name is required.", { fileName: "Choose a file to prepare." });
    const doc: RecyclerDocument = {
      id: `doc_${crypto.randomUUID().slice(0, 8)}`,
      organizationId,
      recyclerReceiptId: receipt.id,
      fileName: fileName.trim(),
      fileSizeBytes: 1024 * 512,
      mimeType: "application/pdf",
      status: "PENDING",
      scanStatus: "PENDING",
      reviewStatus: "PENDING_REVIEW",
      uploadedByName: mockSession.fullName,
      createdAt: new Date().toISOString(),
    };
    store.documents.push(doc);
    receipt.documents = [...(receipt.documents ?? []), doc];
    return doc;
  },

  async finalizeDocumentUpload(organizationId: string, documentId: string): Promise<RecyclerDocument> {
    await delay(400);
    assertCanWrite(mockSession.role(organizationId));
    const store = await getDemoStore();
    const doc = store.documents.find((d) => d.id === documentId && d.organizationId === organizationId) ?? notFound("Document not found.");
    if (doc.status === "UPLOADED") conflicts("Document upload was already finalized.");
    doc.status = "UPLOADED";
    doc.uploadedAt = new Date().toISOString();
    doc.scanStatus = "CLEAN"; // mock malware scanner completes successfully
    doc.checksumSha256 = `sha256:${doc.id.slice(4)}`;
    return doc;
  },

  async reviewDocument(
    organizationId: string,
    documentId: string,
    decision: Extract<ReviewStatus, "ACCEPTED" | "REJECTED">,
    note?: string,
  ): Promise<RecyclerDocument> {
    await delay();
    assertCanReview(mockSession.role(organizationId));
    const store = await getDemoStore();
    const doc = store.documents.find((d) => d.id === documentId && d.organizationId === organizationId) ?? notFound("Document not found.");
    if (doc.scanStatus === "PENDING") conflicts("Malware scan has not completed. Wait for the scan before human review.");
    if (doc.scanStatus === "INFECTED" && decision === "ACCEPTED") {
      conflicts("Infected documents can never be accepted as evidence. Reject the document.");
    }
    if (doc.scanStatus === "INFECTED") decision = "REJECTED";
    if (decision === "REJECTED" && !note?.trim()) {
      throw new ApiError(400, "validation_error", "A rejection requires an explanatory note.", { note: "Explain why the document is rejected." });
    }
    doc.reviewStatus = decision;
    doc.reviewedByName = mockSession.fullName;
    doc.reviewedAt = new Date().toISOString();
    doc.reviewNote = note?.trim();
    return doc;
  },

  async listDocumentsPendingReview(organizationId: string): Promise<RecyclerDocument[]> {
    await delay();
    const store = await getDemoStore();
    return store.documents
      .filter((d) => d.organizationId === organizationId)
      .filter((d) => d.reviewStatus === "PENDING_REVIEW" || d.scanStatus === "INFECTED" || d.scanStatus === "ERROR")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  // ============================ EPR drafts =================================
  async listEprDrafts(organizationId: string): Promise<EprDraft[]> {
    await delay();
    const store = await getDemoStore();
    return store.eprDrafts
      .filter((d) => d.organizationId === organizationId)
      .map((d) => ({
        ...d,
        reviews: store.eprReviews.filter((r) => r.eprDraftId === d.id),
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async createEprDraft(organizationId: string, input: { recyclerReceiptId: string; periodKey: string }): Promise<EprDraft> {
    await delay();
    assertCanWrite(mockSession.role(organizationId));
    const store = await getDemoStore();
    if (!/^\d{4}-Q[1-4]$/.test(input.periodKey)) {
      throw new ApiError(400, "validation_error", "Reporting period must look like 2026-Q4.", {
        periodKey: "Use the format YYYY-Qn, e.g. 2026-Q4.",
      });
    }
    const receipt = store.recyclerReceipts.find((r) => r.id === input.recyclerReceiptId && r.organizationId === organizationId) ?? notFound("Recycler receipt not found in this organization.");
    if (store.eprDrafts.some((d) => d.recyclerReceiptId === receipt.id)) {
      conflicts("This recycler receipt is already reserved by an EPR draft.");
    }
    const accepted = store.documents
      .filter((d) => d.recyclerReceiptId === receipt.id)
      .some((d) => d.reviewStatus === "ACCEPTED");
    if (!accepted) {
      throw new ApiError(400, "validation_error", "Missing evidence: at least one accepted recycler document is required.", {
        recyclerReceiptId: "This receipt has no accepted evidence document yet.",
      });
    }
    const draft: EprDraft = {
      id: `epr_${crypto.randomUUID().slice(0, 8)}`,
      organizationId,
      draftReference: `EPR-${input.periodKey}-${String(store.eprDrafts.length + 1).padStart(3, "0")}`,
      periodKey: input.periodKey,
      recyclerReceiptId: receipt.id,
      recyclerReceipt: receipt,
      sourceMaterialLotId: receipt.sourceMaterialLotId,
      candidateEligibleGrams: receipt.receivedGrams,
      status: "DRAFT",
      reviews: [],
      createdAt: new Date().toISOString(),
    };
    store.eprDrafts.push(draft);
    receipt.reservedByDraftId = draft.id;
    return draft;
  },

  async listEprReviews(organizationId: string, draftId: string): Promise<EprDraftReview[]> {
    await delay();
    const store = await getDemoStore();
    const draft = store.eprDrafts.find((d) => d.id === draftId && d.organizationId === organizationId) ?? notFound("EPR draft not found.");
    return store.eprReviews.filter((r) => r.eprDraftId === draft.id);
  },

  async createEprReview(
    organizationId: string,
    draftId: string,
    input: { decision: EprReviewDecision; note: string },
  ): Promise<EprDraftReview> {
    await delay();
    const role = mockSession.role(organizationId);
    assertCanReview(role);
    const store = await getDemoStore();
    const draft = store.eprDrafts.find((d) => d.id === draftId && d.organizationId === organizationId) ?? notFound("EPR draft not found.");
    if (!input.note?.trim() || input.note.trim().length < 10) {
      throw new ApiError(400, "validation_error", "A review note of at least 10 characters is required.", {
        note: "Explain the decision in at least 10 characters.",
      });
    }
    if (input.decision === "READY_FOR_VERIFICATION") {
      // Separation of duties (Master Prompt §13.4): the actor who recorded the
      // recycler receipt cannot mark the draft ready for verification.
      const recordedBySelf = draft.recyclerReceipt?.recordedByName === mockSession.fullName;
      if (recordedBySelf) {
        forbidden("Separation of duties: you recorded the underlying recycler receipt, so you cannot mark this draft ready for verification.");
      }
      const alreadyReady = store.eprReviews.some((r) => r.eprDraftId === draft.id && r.decision === "READY_FOR_VERIFICATION" && r.reviewerName === mockSession.fullName);
      if (alreadyReady) conflicts("You have already recorded a readiness decision on this draft.");
    }
    const review: EprDraftReview = {
      id: `evr_${crypto.randomUUID().slice(0, 8)}`,
      eprDraftId: draft.id,
      decision: input.decision,
      note: input.note.trim(),
      reviewerName: mockSession.fullName,
      createdAt: new Date().toISOString(),
    };
    store.eprReviews.push(review);
    return review;
  },

  // ============================ Dashboard ==================================
  async getDashboardKpis(organizationId: string, range: { from: string; to: string }): Promise<DashboardKpis> {
    await delay(300);
    const store = await getDemoStore();
    const inRange = (d: string) => withinRange(d, range.from, range.to);
    const weighings = store.weighingEvents.filter((w) => w.organizationId === organizationId && inRange(w.occurredAt));
    const receipts = store.warehouseReceipts.filter((r) => r.organizationId === organizationId && inRange(r.receivedAt));
    const sortings = store.sortingRecords.filter((s) => s.organizationId === organizationId && inRange(s.sortedAt));
    const recyclerReceived = store.recyclerReceipts.filter((r) => r.organizationId === organizationId && inRange(r.receivedAt));
    const accepted = sortings.reduce((s, r) => s + r.acceptedGrams, 0);
    return {
      rangeFrom: range.from,
      rangeTo: range.to,
      collectedGrams: weighings.reduce((s, w) => s + w.weightGrams, 0),
      warehouseReceivedGrams: receipts.reduce((s, r) => s + r.receivedGrams, 0),
      sortingAcceptedGrams: accepted,
      sortingRejectedGrams: sortings.reduce((s, r) => s + r.rejectedGrams, 0),
      sortingLossGrams: sortings.reduce((s, r) => s + r.lossGrams, 0),
      recyclerReceivedGrams: recyclerReceived.reduce((s, r) => s + r.receivedGrams, 0),
      candidateEprEligibleGrams: recyclerReceived
        .filter((r) => (r.evidence ?? []).some((e) => e.linkableToReceipt))
        .reduce((s, r) => s + r.receivedGrams, 0),
      activeCollectionPoints: store.collectionPoints.filter((c) => c.organizationId === organizationId && c.status === "ACTIVE").length,
      activeBags: store.bags.filter((b) => b.organizationId === organizationId && b.status === "ACTIVE").length,
      pendingCustodyTransfers: store.custodyTransfers.filter((t) => t.organizationId === organizationId && t.status === "PENDING").length,
      pendingEvidenceReviews: store.documents.filter((d) => d.organizationId === organizationId && d.reviewStatus === "PENDING_REVIEW").length,
      generatedAt: new Date().toISOString(),
    };
  },

  async getCollectionVolume(organizationId: string, range: { from: string; to: string }): Promise<CollectionVolumePoint[]> {
    await delay(250);
    const store = await getDemoStore();
    const byDay = new Map<string, number>();
    for (const w of store.weighingEvents.filter((w) => w.organizationId === organizationId && withinRange(w.occurredAt, range.from, range.to))) {
      const day = w.occurredAt.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + w.weightGrams);
    }
    return [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, grams]) => ({ date, grams }));
  },

  async getActionCenter(organizationId: string): Promise<ActionItem[]> {
    await delay(200);
    const store = await getDemoStore();
    const actions: ActionItem[] = [];
    for (const t of store.custodyTransfers.filter((t) => t.organizationId === organizationId && t.status === "PENDING")) {
      actions.push({
        id: `act_ct_${t.id}`,
        category: "custody_pending",
        title: `Unacknowledged custody transfer — bag ${t.bag?.code ?? t.bagId}`,
        detail: `Initiated by ${t.initiatedByName} · awaiting response from ${t.toHolderName}`,
        href: "/custody",
        severity: "warning",
      });
    }
    for (const r of store.warehouseReceipts.filter((r) => r.organizationId === organizationId)) {
      const hasSorting = store.sortingRecords.some((s) => s.warehouseReceiptId === r.id);
      if (!hasSorting) {
        actions.push({
          id: `act_sr_${r.id}`,
          category: "sorting_gap",
          title: `Bag ${r.bag?.code ?? r.bagId} received but not sorted`,
          detail: `${(r.receivedGrams / 1000).toFixed(1)} kg awaiting a sorting record`,
          href: "/warehouse/sorting",
          severity: "info",
        });
      }
    }
    for (const d of store.documents.filter((d) => d.organizationId === organizationId)) {
      if (d.scanStatus === "INFECTED") {
        actions.push({
          id: `act_doc_${d.id}`,
          category: "document_rejected",
          title: `Infected document: ${d.fileName}`,
          detail: "Malware scan flagged this file — it can never be accepted as evidence.",
          href: "/recycling/documents",
          severity: "danger",
        });
      } else if (d.reviewStatus === "PENDING_REVIEW") {
        actions.push({
          id: `act_doc_${d.id}`,
          category: "evidence_review",
          title: `Evidence awaiting human review: ${d.fileName}`,
          detail: `Scan status ${d.scanStatus.toLowerCase()} — review required`,
          href: "/recycling/documents",
          severity: "warning",
        });
      }
    }
    for (const draft of store.eprDrafts.filter((d) => d.organizationId === organizationId)) {
      const reviews = store.eprReviews.filter((r) => r.eprDraftId === draft.id);
      if (!reviews.some((r) => r.decision === "READY_FOR_VERIFICATION")) {
        actions.push({
          id: `act_epr_${draft.id}`,
          category: "draft_needs_review",
          title: `Draft ${draft.draftReference} requires additional review`,
          detail: `${reviews.length} review event(s) recorded · status DRAFT`,
          href: `/epr/drafts/${draft.id}`,
          severity: "info",
        });
      }
    }
    return actions;
  },
};
