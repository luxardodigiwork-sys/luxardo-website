/* eslint-disable */
/**
 * LUXARDO FASHION — LOOM PRODUCTION SYSTEM (luxardo-flow)
 *
 * Dedicated Cloud Functions entry for the Loom production system.
 * Re-exports ONLY the 35 Loom callables from the SHARED domain modules
 * (functions/src/*) — zero duplication. No B2C / Razorpay functions are
 * referenced here, so deploying to luxardo-flow never binds B2C secrets
 * and never requires Secret Manager access.
 *
 * Deploy:  firebase deploy --config firebase.loom.json --only functions --project luxardo-flow
 */
import { setGlobalOptions } from "firebase-functions/v2";

/* MUST be the first import so the Admin SDK is initialized before the shared
 * Loom modules build their service handles (db, storage, etc.). */
import "./init";

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

/* V1 Production System — master-data CRUD + atomic ID generation */
export {
  nextId,
  staffCreate,
  staffUpdate,
  staffBackfillCustomerDocs,
  karigarCreate,
  karigarUpdate,
} from "../../functions/src/production";

/* Phase 2 · Block 2.1 — Catalogue Design management + version preservation */
export {
  designCreate,
  designUpdate,
  designSubmit,
  designApprove,
  designSetCatalogueMeta,
  designNewVersion,
} from "../../functions/src/designs";

/* Phase 2 · Block 2.2/2.3 — Sample Design (fabric swatch) + Sample Piece (garment) */
export {
  sampleDesignCreate,
  sampleDesignUpdate,
  sampleDesignSubmit,
  sampleDesignApprove,
  samplePieceCreate,
  samplePieceComplete,
  samplePieceApprove,
} from "../../functions/src/samples";

/* Phase 2 · Block 2.4 — Production Request foundation */
export {
  prCreate,
  prUpdate,
  prSubmit,
  prApprove,
  prReject,
  prEditApproved,
  prReproduce,
  prGeneratePieces,
} from "../../functions/src/productionRequests";

/* Phase 2 · Block 3 — Physical Piece domain */
export {
  pieceAssignKarigar,
  pieceRemoveKarigar,
  recordRework,
  completeRejectPiece,
  createManualReplacementPiece,
  recordPieceMovement,
} from "../../functions/src/pieces";

/* Phase 2 · Block 4 — Karigar + Labour domain */
export {
  labourStart,
  labourStop,
} from "../../functions/src/labour";

/* Phase 3 · Block 5 — Guard QC domain */
export {
  guardQcPerform,
} from "../../functions/src/guardQc";