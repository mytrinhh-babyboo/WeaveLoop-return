/**
 * WeaveLoop domain types.
 *
 * Shapes mirror the NestJS/Prisma models documented in the Master Prompt.
 * Weights are stored and transmitted in GRAMS (integers); the UI converts to
 * kg/tonnes for display only and must never round before sending.
 *
 * Optional properties are typed `X | undefined` explicitly because the
 * project compiles with exactOptionalPropertyTypes.
 */

export type Role = "OWNER" | "ADMIN" | "OPERATOR" | "AUDITOR" | "VIEWER";

export type PartnerType = "RETAILER" | "DISTRIBUTOR" | "RECYCLER";

export type BagStatus = "ISSUED" | "ACTIVE" | "CLOSED";

export type CustodyStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export type DocumentStatus = "PENDING" | "UPLOADED";

export type ScanStatus = "PENDING" | "CLEAN" | "INFECTED" | "ERROR";

export type ReviewStatus = "PENDING_REVIEW" | "ACCEPTED" | "REJECTED";

export type EprReviewDecision = "REQUEST_CHANGES" | "READY_FOR_VERIFICATION";

export type LotOperationType = "SPLIT" | "MERGE";

export interface Timestamped {
  id: string;
  createdAt: string;
  updatedAt?: string | undefined;
}

export interface Organization extends Timestamped {
  name: string;
  code: string;
  country?: string | undefined;
}

export interface UserAccount {
  id: string;
  email: string;
  fullName: string;
}

export interface Membership extends Timestamped {
  organizationId: string;
  organization: Organization;
  role: Role;
  isActive: boolean;
}

export interface Partner extends Timestamped {
  organizationId: string;
  name: string;
  type: PartnerType;
  contactEmail?: string | undefined;
  city?: string | undefined;
  isActive: boolean;
}

export interface CollectionPoint extends Timestamped {
  organizationId: string;
  partnerId?: string | undefined;
  partner?: Partner | undefined;
  code: string;
  name: string;
  address?: string | undefined;
  city?: string | undefined;
  status: "ACTIVE" | "INACTIVE";
  bagCount?: number | undefined;
}

export interface CollectionBag extends Timestamped {
  organizationId: string;
  collectionPointId: string;
  collectionPoint?: CollectionPoint | undefined;
  code: string;
  status: BagStatus;
  issuedAt: string;
  activatedAt?: string | undefined;
  closedAt?: string | undefined;
}

export interface WeighingEvent extends Timestamped {
  organizationId: string;
  bagId: string;
  bag?: CollectionBag | undefined;
  /** Exact grams — never rounded on the client. */
  weightGrams: number;
  actorId?: string | undefined;
  actorName?: string | undefined;
  occurredAt: string;
  recordedAt?: string | undefined;
  source: "OPERATOR_ENTRY" | "SCALE_INTEGRATION" | "IMPORT";
  notes?: string | undefined;
}

export interface CustodyTransfer extends Timestamped {
  organizationId: string;
  bagId: string;
  bag?: CollectionBag | undefined;
  fromHolderName: string;
  toHolderName: string;
  status: CustodyStatus;
  initiatedById?: string | undefined;
  initiatedByName?: string | undefined;
  initiatedAt: string;
  acknowledgedAt?: string | undefined;
  acknowledgedByName?: string | undefined;
  note?: string | undefined;
}

export interface WarehouseReceipt extends Timestamped {
  organizationId: string;
  bagId: string;
  bag?: CollectionBag | undefined;
  receivedGrams: number;
  receivedAt: string;
  recordedByName?: string | undefined;
  idempotencyKey?: string | undefined;
  notes?: string | undefined;
}

export interface SortingRecord extends Timestamped {
  organizationId: string;
  warehouseReceiptId: string;
  warehouseReceipt?: WarehouseReceipt | undefined;
  acceptedGrams: number;
  rejectedGrams: number;
  lossGrams: number;
  sortedAt: string;
  sortedByName?: string | undefined;
  materialType?: string | undefined;
}

export interface MaterialLot extends Timestamped {
  organizationId: string;
  code: string;
  massGrams: number;
  /** grams consumed by later split/merge outputs or receipts */
  consumedGrams?: number | undefined;
  sourceType: "SORTING" | "SPLIT" | "MERGE" | "IMPORT";
  sourceSortingRecordId?: string | undefined;
  consumptionStatus: "AVAILABLE" | "PARTIALLY_CONSUMED" | "CONSUMED";
  recyclerReceiptId?: string | undefined;
}

export interface LotOperation extends Timestamped {
  organizationId: string;
  type: LotOperationType;
  outputLotId: string;
  inputs: LotOperationInput[];
  performedByName?: string | undefined;
  performedAt: string;
}

export interface LotOperationInput {
  lotId: string;
  lotCode?: string | undefined;
  massGrams: number;
}

export interface EvidenceRecord extends Timestamped {
  organizationId: string;
  kind: "PHOTO" | "WEIGHING_SLIP" | "RECEIPT" | "CERTIFICATE" | "OTHER";
  label: string;
  collectedAt?: string | undefined;
  linkableToReceipt: boolean;
}

export interface RecyclerDocument extends Timestamped {
  organizationId: string;
  recyclerReceiptId?: string | undefined;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  status: DocumentStatus;
  scanStatus: ScanStatus;
  reviewStatus: ReviewStatus;
  uploadedAt?: string | undefined;
  uploadedByName?: string | undefined;
  reviewedByName?: string | undefined;
  reviewedAt?: string | undefined;
  reviewNote?: string | undefined;
  checksumSha256?: string | undefined;
}

export interface RecyclerReceipt extends Timestamped {
  organizationId: string;
  reference: string;
  recyclerPartnerId?: string | undefined;
  recyclerPartner?: Partner | undefined;
  sourceMaterialLotId: string;
  sourceMaterialLot?: MaterialLot | undefined;
  receivedGrams: number;
  receivedAt: string;
  recordedByName?: string | undefined;
  documents?: RecyclerDocument[] | undefined;
  evidence?: EvidenceRecord[] | undefined;
  reservedByDraftId?: string | undefined;
}

export interface EprDraft extends Timestamped {
  organizationId: string;
  draftReference: string;
  periodKey: string;
  recyclerReceiptId: string;
  recyclerReceipt?: RecyclerReceipt | undefined;
  sourceMaterialLotId?: string | undefined;
  candidateEligibleGrams: number;
  status: "DRAFT";
  reviews?: EprDraftReview[] | undefined;
}

export interface EprDraftReview extends Timestamped {
  eprDraftId: string;
  decision: EprReviewDecision;
  note: string;
  reviewerId?: string | undefined;
  reviewerName?: string | undefined;
  createdAt: string;
}

export interface DashboardKpis {
  rangeFrom: string;
  rangeTo: string;
  /** Total weight recorded by weighing events (collected) */
  collectedGrams: number;
  warehouseReceivedGrams: number;
  sortingAcceptedGrams: number;
  sortingRejectedGrams: number;
  sortingLossGrams: number;
  recyclerReceivedGrams: number;
  candidateEprEligibleGrams: number;
  activeCollectionPoints: number;
  activeBags: number;
  pendingCustodyTransfers: number;
  pendingEvidenceReviews: number;
  generatedAt: string;
}

export interface MaterialFlowPoint {
  label: string;
  grams: number;
}

export interface CollectionVolumePoint {
  date: string;
  grams: number;
}

export interface ReviewStatusDistribution {
  status: ReviewStatus;
  count: number;
}

export interface ActionItem {
  id: string;
  category:
    | "custody_pending"
    | "bag_awaiting_receipt"
    | "sorting_gap"
    | "missing_evidence"
    | "evidence_review"
    | "document_rejected"
    | "draft_needs_review";
  title: string;
  detail: string;
  href: string;
  severity: "warning" | "danger" | "info";
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; pageSize: number };
}
