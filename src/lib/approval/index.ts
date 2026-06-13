// Public surface of the approval engine. Existing imports of "@/lib/approval"
// resolve here unchanged.
export { instantiateLeaveApproval, actOnLeaveRequest } from "./leave";
export { instantiateOtApproval, actOnOtRequest } from "./ot";
export { instantiateDocumentApproval, actOnDocRequest } from "./document";
export type { ActResult } from "./core";
