/**
 * WeaveLoop demo dataset.
 *
 * Used only when VITE_USE_MOCK_API=true (the default while the external
 * NestJS instance is offline). The dataset is generated lazily with a
 * deterministic PRNG — no Math.random() at module scope — so every reload
 * shows the same operational picture and mutations remain meaningful.
 *
 * The UI always labels data served from here as DEMO data.
 */
import type {
  CollectionBag,
  CollectionPoint,
  CustodyTransfer,
  EprDraft,
  EprDraftReview,
  EvidenceRecord,
  LotOperation,
  MaterialLot,
  Membership,
  Partner,
  RecyclerDocument,
  RecyclerReceipt,
  SortingRecord,
  WarehouseReceipt,
  WeighingEvent,
} from "../types";

export interface DemoStore {
  memberships: Membership[];
  partners: Partner[];
  collectionPoints: CollectionPoint[];
  bags: CollectionBag[];
  weighingEvents: WeighingEvent[];
  custodyTransfers: CustodyTransfer[];
  warehouseReceipts: WarehouseReceipt[];
  sortingRecords: SortingRecord[];
  materialLots: MaterialLot[];
  lotOperations: LotOperation[];
  evidence: EvidenceRecord[];
  recyclerReceipts: RecyclerReceipt[];
  documents: RecyclerDocument[];
  eprDrafts: EprDraft[];
  eprReviews: EprDraftReview[];
  actors: string[];
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 24 * 60 * 60 * 1000;
const now = () => Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

let storePromise: Promise<DemoStore> | undefined;

export function getDemoStore(): Promise<DemoStore> {
  if (!storePromise) {
    storePromise = Promise.resolve(buildStore());
  }
  return storePromise;
}

function buildStore(): DemoStore {
  const rand = mulberry32(20261026);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)] as T;

  const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  const daysAgo = (d: number) => iso(now() - d * DAY);
  const uid = (prefix: string, n: number) => `${prefix}_${String(n).padStart(4, "0")}`;

  const actors = ["Trịnh Mỹ Linh", "Nguyễn Văn Hùng", "Lê Thị Cẩm", "Phạm Quốc Duy", "Võ Ngọc Lan"];
  const orgs: Membership[] = [
    {
      id: "mem_0001",
      organizationId: "org_0001",
      role: "ADMIN",
      isActive: true,
      createdAt: daysAgo(400),
      organization: {
        id: "org_0001",
        name: "Saigon Circular Packaging Co-op",
        code: "SGN-CPC",
        country: "VN",
        createdAt: daysAgo(420),
      },
    },
    {
      id: "mem_0002",
      organizationId: "org_0002",
      role: "OPERATOR",
      isActive: true,
      createdAt: daysAgo(120),
      organization: {
        id: "org_0002",
        name: "Hanoi Green Loop Collectives",
        code: "HNI-GLC",
        country: "VN",
        createdAt: daysAgo(300),
      },
    },
  ];

  const partners: Partner[] = [
    ["pt_0001", "org_0001", "CircleK Vietnam", "RETAILER", "operations@circlek.example", "Ho Chi Minh City"],
    ["pt_0002", "org_0001", "WinMart Nguyễn Trãi", "RETAILER", "store.ops@winmart.example", "Ho Chi Minh City"],
    ["pt_0003", "org_0001", "Saigon Co.op District 3", "RETAILER", "d3@coop.example", "Ho Chi Minh City"],
    ["pt_0004", "org_0001", "Vinamilk Distribution", "DISTRIBUTOR", "logistics@vinamilk.example", "Ho Chi Minh City"],
    ["pt_0005", "org_0001", "Vietnam Recycle Industries", "RECYCLER", "intake@vri.example", "Binh Duong"],
    ["pt_0006", "org_0001", "Duy Tan Recycling", "RECYCLER", "receiving@duytan.example", "Long An"],
    ["pt_0007", "org_0002", "Lotte Mart Cầu Giấy", "RETAILER", "cg@lotte.example", "Hanoi"],
    ["pt_0008", "org_0002", "Green Recycler North", "RECYCLER", "hello@greenrec.example", "Hanoi"],
  ].map(([id, organizationId, name, type, contactEmail, city], i) => ({
    id: id as string,
    organizationId: organizationId as string,
    name: name as string,
    type: type as Partner["type"],
    contactEmail: contactEmail as string,
    city: city as string,
    isActive: true,
    createdAt: daysAgo(360 - i),
  }));

  const collectionPoints: CollectionPoint[] = (
    [
      ["cp_0001", "org_0001", "pt_0001", "CP-SGN-001", "CircleK Lê Văn Việt", "Thu Duc, Ho Chi Minh City", "ACTIVE"],
      ["cp_0002", "org_0001", "pt_0002", "CP-SGN-002", "WinMart Nguyễn Trãi", "District 1, Ho Chi Minh City", "ACTIVE"],
      ["cp_0003", "org_0001", "pt_0003", "CP-SGN-003", "Co.op X-Time Điện Biên Phủ", "District 3, Ho Chi Minh City", "ACTIVE"],
      ["cp_0004", "org_0001", "pt_0004", "CP-SGN-004", "Vinamilk Warehouse Bến Cát", "Binh Duong", "ACTIVE"],
      ["cp_0005", "org_0001", "pt_0001", "CP-SGN-005", "CircleK Quang Trung", "Go Vap, Ho Chi Minh City", "ACTIVE"],
      ["cp_0006", "org_0001", null, "CP-SGN-006", "Cộng Coffee Nguyễn Huệ (pilot)", "District 1, Ho Chi Minh City", "INACTIVE"],
      ["cp_0007", "org_0002", "pt_0007", "CP-HNI-001", "Lotte Cầu Giấy reverse bin", "Cau Giay, Hanoi", "ACTIVE"],
    ] as Array<[string, string, string | null, string, string, string, "ACTIVE" | "INACTIVE"]>
  ).map(([id, organizationId, partnerId, code, name, address, status], i) => ({
    id,
    organizationId,
    partnerId: partnerId ?? undefined,
    code,
    name,
    address,
    city: address.split(", ").pop() ?? address,
    status,
    createdAt: daysAgo(300 - i * 20),
  }));
  for (const cp of collectionPoints) {
    cp.partner = partners.find((p) => p.id === cp.partnerId);
  }


  // ---- Bags -------------------------------------------------------------
  const bags: CollectionBag[] = [];
  let bagN = 0;
  for (const cp of collectionPoints) {
    const count = cp.status === "ACTIVE" ? int(3, 5) : 2;
    for (let i = 0; i < count; i++) {
      bagN += 1;
      const issued = int(70, 20);
      const status: CollectionBag["status"] = issued > 55 ? "ISSUED" : rand() > 0.35 ? "CLOSED" : "ACTIVE";
      bags.push({
        id: uid("bag", bagN),
        organizationId: cp.organizationId,
        collectionPointId: cp.id,
        collectionPoint: cp,
        code: `BAG-${cp.code.replace("CP-", "")}-${String(bagN).padStart(3, "0")}`,
        status,
        issuedAt: daysAgo(issued),
        activatedAt: status === "ISSUED" ? undefined : daysAgo(issued - int(1, 3)),
        closedAt: status === "CLOSED" ? daysAgo(int(2, 20)) : undefined,
        createdAt: daysAgo(issued),
      });
    }
  }

  // ---- Weighing events --------------------------------------------------
  const weighingEvents: WeighingEvent[] = [];
  let weN = 0;
  for (const bag of bags) {
    if (bag.status === "ISSUED") continue;
    const events = bag.status === "ACTIVE" ? int(2, 4) : 3;
    for (let i = 0; i < events; i++) {
      weN += 1;
      const occurred = now() - int(1, 45) * DAY - int(0, 8) * 3600 * 1000;
      weighingEvents.push({
        id: uid("we", weN),
        organizationId: bag.organizationId,
        bagId: bag.id,
        bag,
        weightGrams: int(3, 18) * 1000 + int(50, 950),
        actorId: "actor",
        actorName: pick(actors),
        occurredAt: iso(occurred),
        recordedAt: iso(occurred + int(0, 40) * 60000),
        source: rand() > 0.25 ? "OPERATOR_ENTRY" : "SCALE_INTEGRATION",
        notes: rand() > 0.85 ? "Mixed flexible plastics, visibly clean." : undefined,
        createdAt: iso(occurred),
      });
    }
  }

  // ---- Custody transfers ------------------------------------------------
  const warehouse = "SGN Consolidation Warehouse";
  const custodyTransfers: CustodyTransfer[] = [];
  let ctN = 0;
  for (const bag of bags) {
    if (bag.status === "ISSUED") continue;
    ctN += 1;
    const initiated = now() - int(2, 40) * DAY;
    const status: CustodyTransfer["status"] = bag.status === "CLOSED" ? (rand() > 0.12 ? "ACCEPTED" : "REJECTED") : rand() > 0.5 ? "PENDING" : "ACCEPTED";
    custodyTransfers.push({
      id: uid("ct", ctN),
      organizationId: bag.organizationId,
      bagId: bag.id,
      bag,
      fromHolderName: bag.collectionPoint?.name ?? "Collection point",
      toHolderName: warehouse,
      status,
      initiatedByName: pick(actors),
      initiatedAt: iso(initiated),
      acknowledgedAt: status === "PENDING" ? undefined : iso(initiated + int(2, 20) * 3600 * 1000),
      acknowledgedByName: status === "PENDING" ? undefined : pick(actors),
      note: status === "REJECTED" ? "Bag seal broken on arrival — returned to collection point." : undefined,
      createdAt: iso(initiated),
    });
  }

  // ---- Warehouse receipts (for accepted transfers) -----------------------
  const warehouseReceipts: WarehouseReceipt[] = [];
  let wrN = 0;
  for (const transfer of custodyTransfers) {
    if (transfer.status !== "ACCEPTED") continue;
    wrN += 1;
    const bagWeighings = weighingEvents.filter((w) => w.bagId === transfer.bagId);
    const received = bagWeighings.reduce((sum, w) => sum + w.weightGrams, 0);
    if (received <= 0) continue;
    warehouseReceipts.push({
      id: uid("wr", wrN),
      organizationId: transfer.organizationId,
      bagId: transfer.bagId,
      bag: transfer.bag,
      receivedGrams: received,
      receivedAt: transfer.acknowledgedAt!,
      recordedByName: transfer.acknowledgedByName,
      idempotencyKey: `wr-${transfer.id}`,
      notes: undefined,
      createdAt: transfer.acknowledgedAt!,
    });
  }

  // ---- Sorting records (one per receipt, a few with gaps) ----------------
  const sortingRecords: SortingRecord[] = [];
  let srN = 0;
  for (const receipt of warehouseReceipts) {
    if (rand() > 0.12) {
      srN += 1;
      const accepted = Math.floor(receipt.receivedGrams * (0.68 + rand() * 0.22));
      const rejected = Math.floor(receipt.receivedGrams * rand() * 0.12);
      const loss = receipt.receivedGrams - accepted - rejected;
      sortingRecords.push({
        id: uid("sr", srN),
        organizationId: receipt.organizationId,
        warehouseReceiptId: receipt.id,
        warehouseReceipt: receipt,
        acceptedGrams: accepted,
        rejectedGrams: rejected,
        lossGrams: loss < 0 ? 0 : loss,
        sortedAt: iso(new Date(receipt.receivedAt).getTime() + int(1, 48) * 3600 * 1000),
        sortedByName: pick(actors),
        materialType: pick(["PET bottles", "HDPE", "Flexible LDPE", "PP containers"]),
        createdAt: iso(new Date(receipt.receivedAt).getTime() + int(1, 48) * 3600 * 1000),
      });
    }
  }

  // ---- Material lots from sorting ---------------------------------------
  const materialLots: MaterialLot[] = [];
  let lotN = 0;
  const lotCode = () => `LOT-SGN-${String(++lotN).padStart(3, "0")}`;
  const sourceLots: MaterialLot[] = [];
  for (const sorting of sortingRecords) {
    lotN += 1;
    const lot: MaterialLot = {
      id: uid("lot", lotN),
      organizationId: sorting.organizationId,
      code: `LOT-SGN-${String(lotN).padStart(3, "0")}`,
      massGrams: sorting.acceptedGrams,
      consumedGrams: 0,
      sourceType: "SORTING",
      sourceSortingRecordId: sorting.id,
      consumptionStatus: "AVAILABLE",
      createdAt: sorting.sortedAt,
    };
    materialLots.push(lot);
    sourceLots.push(lot);
  }

  // A SPLIT of the newest source lot into two lots
  const splitSource = sourceLots[sourceLots.length - 1]!;

  const splitA = Math.floor(splitSource.massGrams * 0.6);
  const splitB = splitSource.massGrams - splitA;
  const childA: MaterialLot = {
    ...splitSource,
    id: uid("lot", ++lotN),
    code: `LOT-SGN-${String(lotN).padStart(3, "0")}`,
    massGrams: splitA,
    sourceType: "SPLIT",
    sourceSortingRecordId: undefined,
    createdAt: daysAgo(6),
  };
  const childB: MaterialLot = { ...childA, id: uid("lot", ++lotN), code: `LOT-SGN-${String(lotN).padStart(3, "0")}`, massGrams: splitB };
  materialLots.push(childA, childB);
  splitSource.consumptionStatus = "CONSUMED";
  splitSource.consumedGrams = splitSource.massGrams;
  const splitOp: LotOperation = {
    id: "lo_0001",
    organizationId: childA.organizationId,
    type: "SPLIT",
    outputLotId: childA.id,
    inputs: [{ lotId: splitSource.id, lotCode: splitSource.code, massGrams: splitSource.massGrams }],
    performedByName: pick(actors),
    performedAt: daysAgo(6),
    createdAt: daysAgo(6),
  };
  // A MERGE of the two split children
  const merged: MaterialLot = {
    id: uid("lot", ++lotN),
    organizationId: childA.organizationId,
    code: `LOT-SGN-${String(lotN).padStart(3, "0")}`,
    massGrams: splitA + splitB,
    consumedGrams: 0,
    sourceType: "MERGE",
    consumptionStatus: "AVAILABLE",
    createdAt: daysAgo(3),
  };
  materialLots.push(merged);
  childA.consumptionStatus = "CONSUMED";
  childB.consumptionStatus = "CONSUMED";
  childA.consumedGrams = childA.massGrams;
  childB.consumedGrams = childB.massGrams;
  const mergeOp: LotOperation = {
    id: "lo_0002",
    organizationId: childA.organizationId,
    type: "MERGE",
    outputLotId: merged.id,
    inputs: [
      { lotId: childA.id, lotCode: childA.code, massGrams: childA.massGrams },
      { lotId: childB.id, lotCode: childB.code, massGrams: childB.massGrams },
    ],
    performedByName: pick(actors),
    performedAt: daysAgo(3),
    createdAt: daysAgo(3),
  };

  // ---- Evidence & recycler receipts -------------------------------------
  const evidence: EvidenceRecord[] = sourceLots.slice(0, 4).map((lot, i) => ({
    id: uid("ev", i + 1),
    organizationId: lot.organizationId,
    kind: pick(["PHOTO", "WEIGHING_SLIP", "RECEIPT", "CERTIFICATE"] as EvidenceRecord["kind"][]),
    label: `${lot.code} handover evidence`,
    collectedAt: lot.createdAt,
    linkableToReceipt: true,
    createdAt: lot.createdAt,
  }));

  const recyclerPartners = partners.filter((p) => p.type === "RECYCLER" && p.organizationId === "org_0001");
  const recyclerReceipts: RecyclerReceipt[] = [];
  let rrN = 0;
  const receiptCandidates = [...materialLots].filter((l) => l.sourceType === "SORTING" && l.consumptionStatus === "AVAILABLE").slice(0, 5);
  receiptCandidates.push(merged);
  for (const lot of receiptCandidates) {
    rrN += 1;
    const received = Math.floor(lot.massGrams * (0.94 + rand() * 0.06));
    const receipt: RecyclerReceipt = {
      id: uid("rr", rrN),
      organizationId: lot.organizationId,
      reference: `RR-2026-${String(rrN).padStart(4, "0")}`,
      recyclerPartnerId: pick(recyclerPartners).id,
      recyclerPartner: pick(recyclerPartners),
      sourceMaterialLotId: lot.id,
      sourceMaterialLot: lot,
      receivedGrams: received,
      receivedAt: iso(new Date(lot.createdAt).getTime() + int(2, 10) * DAY),
      recordedByName: pick(actors),
      evidence: evidence.slice(0, int(1, 3)),
      createdAt: iso(new Date(lot.createdAt).getTime() + int(2, 10) * DAY),
    };
    lot.consumptionStatus = "CONSUMED";
    lot.consumedGrams = lot.massGrams;
    lot.recyclerReceiptId = receipt.id;
    recyclerReceipts.push(receipt);
  }

  // ---- Documents with scan/review states --------------------------------
  const documents: RecyclerDocument[] = [];
  let docN = 0;
  const docProfiles: Array<{ scan: RecyclerDocument["scanStatus"]; review: RecyclerDocument["reviewStatus"]; name: string }> = [
    { scan: "CLEAN", review: "ACCEPTED", name: "weighbridge-ticket.pdf" },
    { scan: "CLEAN", review: "PENDING_REVIEW", name: "recycler-intake-note.pdf" },
    { scan: "PENDING", review: "PENDING_REVIEW", name: "handover-photo-set.zip" },
    { scan: "INFECTED", review: "PENDING_REVIEW", name: "supplier-invoice-scan.pdf" },
    { scan: "CLEAN", review: "REJECTED", name: "receipt-summary-draft.pdf" },
    { scan: "ERROR", review: "PENDING_REVIEW", name: "container-manifest.pdf" },
  ];
  for (const receipt of recyclerReceipts) {
    const count = int(1, 2);
    for (let i = 0; i < count; i++) {
      docN += 1;
      const profile = docProfiles[(docN - 1) % docProfiles.length]!;

      documents.push({
        id: uid("doc", docN),
        organizationId: receipt.organizationId,
        recyclerReceiptId: receipt.id,
        fileName: profile.name,
        fileSizeBytes: int(120, 4200) * 1024,
        mimeType: profile.name.endsWith(".zip") ? "application/zip" : "application/pdf",
        status: profile.scan === "PENDING" ? "PENDING" : "UPLOADED",
        scanStatus: profile.scan,
        reviewStatus: profile.review,
        uploadedAt: receipt.receivedAt,
        uploadedByName: pick(actors),
        reviewedByName: profile.review === "PENDING_REVIEW" ? undefined : pick(actors),
        reviewedAt: profile.review === "PENDING_REVIEW" ? undefined : daysAgo(int(1, 5)),
        reviewNote:
          profile.review === "REJECTED"
            ? "Document references a different material lot than the linked receipt."
            : profile.review === "ACCEPTED"
              ? "Ticket matches weighbridge record and recycler confirmation."
              : undefined,
        checksumSha256: `3f2a9c${String(docN).padStart(4, "0")}e8b1d4c7a6f0592d3b7c81e4fa6d209c5518b3e7ca92d4f61a8b5c3e79d204f`,
        createdAt: receipt.receivedAt,
      });
    }
  }
  recyclerReceipts.forEach((r) => {
    r.documents = documents.filter((d) => d.recyclerReceiptId === r.id);
  });

  // ---- EPR drafts & reviews ---------------------------------------------
  const eprDrafts: EprDraft[] = [];
  const eprReviews: EprDraftReview[] = [];
  const draftable = recyclerReceipts.slice(0, 2);
  draftable.forEach((receipt, i) => {
    const draftId = uid("epr", i + 1);
    eprDrafts.push({
      id: draftId,
      organizationId: receipt.organizationId,
      draftReference: `EPR-2026-Q4-${String(i + 1).padStart(3, "0")}`,
      periodKey: "2026-Q4",
      recyclerReceiptId: receipt.id,
      recyclerReceipt: receipt,
      sourceMaterialLotId: receipt.sourceMaterialLotId,
      candidateEligibleGrams: receipt.receivedGrams,
      status: "DRAFT",
      reviews: [],
      createdAt: daysAgo(9 - i * 2),
    });
    receipt.reservedByDraftId = draftId;
    if (i === 0) {
      eprReviews.push({
        id: "evr_0001",
        eprDraftId: draftId,
        decision: "REQUEST_CHANGES",
        note: "Please attach the recycler weighbridge ticket — the handover photo set alone is insufficient.",
        reviewerName: "Lê Thị Cẩm",
        createdAt: daysAgo(5),
      });
      eprReviews.push({
        id: "evr_0002",
        eprDraftId: draftId,
        decision: "REQUEST_CHANGES",
        note: "Material lot mass differs from received mass by 4.1%. Document the loss before resubmitting.",
        reviewerName: "Phạm Quốc Duy",
        createdAt: daysAgo(2),
      });
    } else {
      eprReviews.push({
        id: "evr_0003",
        eprDraftId: draftId,
        decision: "READY_FOR_VERIFICATION",
        note: "Evidence complete: weighbridge ticket accepted, mass within tolerance. Flagged for independent external checking.",
        reviewerName: "Lê Thị Cẩm",
        createdAt: daysAgo(1),
      });
    }
    const created = eprDrafts[i]!;
    created.reviews = eprReviews.filter((r) => r.eprDraftId === created.id);

  });

  const store: DemoStore = {
    memberships: orgs,
    partners,
    collectionPoints,
    bags,
    weighingEvents,
    custodyTransfers,
    warehouseReceipts,
    sortingRecords,
    materialLots,
    lotOperations: [splitOp, mergeOp],
    evidence,
    recyclerReceipts,
    documents,
    eprDrafts,
    eprReviews,
    actors,
  };
  return store;
}
