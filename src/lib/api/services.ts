/**
 * WeaveLoop API services.
 *
 * Each domain service exposes typed operations. When the demo/mock toggle is
 * off, calls go to the real NestJS endpoints over HTTP (cookie session,
 * organization context header). Endpoint paths follow the documented NestJS
 * contract; they are verified against the Swagger spec at connect time.
 */
import { createApiClient, type ApiClient } from "./client";
import { getApiConfig } from "./config";
import { mockApi, mockSession } from "./mock/mock-api";
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
  SortingRecord,
  WarehouseReceipt,
  WeighingEvent,
} from "./types";

const config = getApiConfig();
const client: ApiClient = createApiClient(config);

/** True when the platform is serving the in-browser demo dataset. */
export const isMockMode = () => config.useMock;
export { mockSession, config as apiConfig };

function org(organizationId: string) {
  return { organizationId };
}

// ============================ Auth & Organizations =========================
export const organizations = {
  listMemberships: (): Promise<Membership[]> =>
    config.useMock ? mockApi.listMemberships() : client.get("/organizations/memberships"),
  listPartners: (organizationId: string, params: { type?: Partner["type"]; search?: string } = {}): Promise<Partner[]> =>
    config.useMock
      ? mockApi.listPartners(organizationId, params)
      : client.get("/partners", { query: params, ...org(organizationId) }),
};

// ============================ Collection ==================================
export const collection = {
  listPoints: (
    organizationId: string,
    params: { search?: string; status?: string; partnerId?: string; page?: number; pageSize?: number } = {},
  ): Promise<Paginated<CollectionPoint>> =>
    config.useMock ? mockApi.listCollectionPoints(organizationId, params) : client.get("/collection-points", { query: params, ...org(organizationId) }),
  createPoint: (
    organizationId: string,
    input: { code: string; name: string; partnerId?: string; address?: string; city?: string },
  ): Promise<CollectionPoint> =>
    config.useMock ? mockApi.createCollectionPoint(organizationId, input) : client.post("/collection-points", { body: input, ...org(organizationId) }),
  listBags: (
    organizationId: string,
    params: { search?: string; status?: BagStatus; collectionPointId?: string; page?: number; pageSize?: number } = {},
  ): Promise<Paginated<CollectionBag>> =>
    config.useMock ? mockApi.listBags(organizationId, params) : client.get("/collection-bags", { query: params, ...org(organizationId) }),
  getBag: (organizationId: string, bagId: string): Promise<CollectionBag> =>
    config.useMock ? mockApi.getBag(organizationId, bagId) : client.get(`/collection-bags/${bagId}`, org(organizationId)),
  issueBag: (organizationId: string, input: { collectionPointId: string }): Promise<CollectionBag> =>
    config.useMock ? mockApi.issueBag(organizationId, input) : client.post("/collection-bags", { body: input, ...org(organizationId) }),
  lookupBagByCode: (organizationId: string, code: string): Promise<CollectionBag> =>
    config.useMock ? mockApi.lookupBagByCode(organizationId, code) : client.get("/collection-bags/lookup", { query: { code }, ...org(organizationId) }),
  listWeighings: (
    organizationId: string,
    params: { bagId?: string; from?: string; to?: string; page?: number; pageSize?: number } = {},
  ): Promise<Paginated<WeighingEvent>> =>
    config.useMock ? mockApi.listWeighingEvents(organizationId, params) : client.get("/weighing-events", { query: params, ...org(organizationId) }),
  createWeighing: (
    organizationId: string,
    input: { bagId: string; weightGrams: number; occurredAt: string; source: WeighingEvent["source"]; notes?: string },
    idempotencyKey?: string,
  ): Promise<WeighingEvent> =>
    config.useMock
      ? mockApi.createWeighingEvent(organizationId, input, idempotencyKey)
      : client.post("/weighing-events", { body: input, idempotencyKey, ...org(organizationId) }),
};

// ============================ Custody =====================================
export const custody = {
  listTransfers: (
    organizationId: string,
    params: { status?: CustodyStatus; search?: string; page?: number; pageSize?: number } = {},
  ): Promise<Paginated<CustodyTransfer>> =>
    config.useMock ? mockApi.listCustodyTransfers(organizationId, params) : client.get("/custody/transfers", { query: params, ...org(organizationId) }),
  createTransfer: (organizationId: string, input: { bagId: string; toHolderName: string; note?: string }): Promise<CustodyTransfer> =>
    config.useMock ? mockApi.createCustodyTransfer(organizationId, input) : client.post("/custody/transfers", { body: input, ...org(organizationId) }),
  acknowledge: (
    organizationId: string,
    transferId: string,
    decision: Extract<CustodyStatus, "ACCEPTED" | "REJECTED">,
    note?: string,
  ): Promise<CustodyTransfer> =>
    config.useMock
      ? mockApi.acknowledgeCustodyTransfer(organizationId, transferId, decision, note)
      : client.post(`/custody/transfers/${transferId}/acknowledge`, { body: { decision, note }, ...org(organizationId) }),
};

// ============================ Warehouse & sorting =========================
export const warehouse = {
  listReceipts: (organizationId: string, params: { search?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<WarehouseReceipt>> =>
    config.useMock ? mockApi.listWarehouseReceipts(organizationId, params) : client.get("/warehouse/receipts", { query: params, ...org(organizationId) }),
  createReceipt: (
    organizationId: string,
    input: { bagId: string; receivedGrams: number; receivedAt: string; notes?: string },
    idempotencyKey?: string,
  ): Promise<WarehouseReceipt> =>
    config.useMock
      ? mockApi.createWarehouseReceipt(organizationId, input, idempotencyKey)
      : client.post("/warehouse/receipts", { body: input, idempotencyKey, ...org(organizationId) }),
  listSorting: (organizationId: string): Promise<SortingRecord[]> =>
    config.useMock ? mockApi.listSortingRecords(organizationId) : client.get("/warehouse/sorting-records", org(organizationId)),
  createSorting: (
    organizationId: string,
    input: { warehouseReceiptId: string; acceptedGrams: number; rejectedGrams: number; lossGrams: number; materialType?: string },
  ): Promise<SortingRecord> =>
    config.useMock ? mockApi.createSortingRecord(organizationId, input) : client.post("/warehouse/sorting-records", { body: input, ...org(organizationId) }),
};

// ============================ Material lots ===============================
export const materials = {
  listLots: (organizationId: string, params: { search?: string; status?: string } = {}): Promise<MaterialLot[]> =>
    config.useMock ? mockApi.listMaterialLots(organizationId, params) : client.get("/material-lots", { query: params, ...org(organizationId) }),
  getLineage: (organizationId: string, lotId: string): Promise<{ lot: MaterialLot; operations: LotOperation[] }> =>
    config.useMock ? mockApi.getLotLineage(organizationId, lotId) : client.get(`/material-lots/${lotId}/lineage`, org(organizationId)),
  split: (organizationId: string, lotId: string, parts: Array<{ code?: string; massGrams: number }>): Promise<LotOperation> =>
    config.useMock ? mockApi.splitLot(organizationId, lotId, parts) : client.post(`/material-lots/${lotId}/split`, { body: { parts }, ...org(organizationId) }),
  merge: (organizationId: string, inputLotIds: string[]): Promise<LotOperation> =>
    config.useMock ? mockApi.mergeLots(organizationId, inputLotIds) : client.post("/material-lots/merge", { body: { inputLotIds }, ...org(organizationId) }),
};

// ============================ Recyclers & evidence ========================
export const recyclers = {
  listReceipts: (organizationId: string, params: { search?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<RecyclerReceipt>> =>
    config.useMock ? mockApi.listRecyclerReceipts(organizationId, params) : client.get("/recycler-receipts", { query: params, ...org(organizationId) }),
  createReceipt: (
    organizationId: string,
    input: { sourceMaterialLotId: string; recyclerPartnerId: string; receivedGrams: number; receivedAt: string },
  ): Promise<RecyclerReceipt> =>
    config.useMock ? mockApi.createRecyclerReceipt(organizationId, input) : client.post("/recycler-receipts", { body: input, ...org(organizationId) }),
  linkEvidence: (organizationId: string, receiptId: string, evidenceId: string): Promise<RecyclerReceipt> =>
    config.useMock ? mockApi.linkEvidence(organizationId, receiptId, evidenceId) : client.post(`/recycler-receipts/${receiptId}/evidence`, { body: { evidenceId }, ...org(organizationId) }),
  prepareDocument: (organizationId: string, receiptId: string, fileName: string): Promise<RecyclerDocument> =>
    config.useMock ? mockApi.prepareDocument(organizationId, receiptId, fileName) : client.post(`/recycler-receipts/${receiptId}/documents/prepare`, { body: { fileName }, ...org(organizationId) }),
  finalizeUpload: (organizationId: string, documentId: string): Promise<RecyclerDocument> =>
    config.useMock ? mockApi.finalizeDocumentUpload(organizationId, documentId) : client.post(`/documents/${documentId}/finalize-upload`, org(organizationId)),
  reviewDocument: (
    organizationId: string,
    documentId: string,
    decision: Extract<ReviewStatus, "ACCEPTED" | "REJECTED">,
    note?: string,
  ): Promise<RecyclerDocument> =>
    config.useMock
      ? mockApi.reviewDocument(organizationId, documentId, decision, note)
      : client.post(`/documents/${documentId}/review`, { body: { decision, note }, ...org(organizationId) }),
  listPendingReviewDocuments: (organizationId: string): Promise<RecyclerDocument[]> =>
    config.useMock ? mockApi.listDocumentsPendingReview(organizationId) : client.get("/documents/pending-review", org(organizationId)),
};

// ============================ EPR drafts ==================================
export const epr = {
  listDrafts: (organizationId: string): Promise<EprDraft[]> =>
    config.useMock ? mockApi.listEprDrafts(organizationId) : client.get("/epr/drafts", org(organizationId)),
  createDraft: (organizationId: string, input: { recyclerReceiptId: string; periodKey: string }): Promise<EprDraft> =>
    config.useMock ? mockApi.createEprDraft(organizationId, input) : client.post("/epr/drafts", { body: input, ...org(organizationId) }),
  listReviews: (organizationId: string, draftId: string): Promise<EprDraftReview[]> =>
    config.useMock ? mockApi.listEprReviews(organizationId, draftId) : client.get(`/epr/drafts/${draftId}/reviews`, org(organizationId)),
  createReview: (organizationId: string, draftId: string, input: { decision: EprReviewDecision; note: string }): Promise<EprDraftReview> =>
    config.useMock ? mockApi.createEprReview(organizationId, draftId, input) : client.post(`/epr/drafts/${draftId}/reviews`, { body: input, ...org(organizationId) }),
};

// ============================ Dashboard ===================================
export const dashboard = {
  getKpis: (organizationId: string, range: { from: string; to: string }): Promise<DashboardKpis> =>
    config.useMock ? mockApi.getDashboardKpis(organizationId, range) : client.get("/dashboard/kpis", { query: range, ...org(organizationId) }),
  getCollectionVolume: (organizationId: string, range: { from: string; to: string }): Promise<CollectionVolumePoint[]> =>
    config.useMock ? mockApi.getCollectionVolume(organizationId, range) : client.get("/dashboard/collection-volume", { query: range, ...org(organizationId) }),
  getActions: (organizationId: string): Promise<ActionItem[]> =>
    config.useMock ? mockApi.getActionCenter(organizationId) : client.get("/dashboard/actions", org(organizationId)),
};
