// GraphQL documents for the Website Intake & Qualification Agent (SOW §10).
// The server returns ONLY the minimal ack/enum fields selected here — never
// record data (see noblestride-crm/src/server/services/client-intake.ts).

export const CHECK_COMPANY = /* GraphQL */ `
  query AgentCheckCompany($name: String!, $contactEmail: String) {
    checkCompany(name: $name, contactEmail: $contactEmail) {
      status
    }
  }
`;

export const SUBMIT_WEBSITE_INTAKE = /* GraphQL */ `
  mutation AgentSubmitWebsiteIntake($input: WebsiteIntakeInput!) {
    submitWebsiteIntake(input: $input) {
      ok
    }
  }
`;

export const LOG_CLIENT_MESSAGE = /* GraphQL */ `
  mutation AgentLogClientMessage($input: LogClientMessageInput!) {
    logInboundClientMessage(input: $input) {
      ok
      verified
    }
  }
`;

// Client status flow (spec 2026-07-14). CLIENT_STATUS selects EXACTLY the 10
// whitelisted fields on ClientStatusPayload — never add a field here without
// a matching change to the CRM's ClientStatusPayloadRef.
export const REQUEST_STATUS_OTP = /* GraphQL */ `
  mutation AgentRequestStatusOtp($companyName: String!, $contactEmail: String!) {
    requestClientStatusOtp(companyName: $companyName, contactEmail: $contactEmail) {
      ok
    }
  }
`;

export const VERIFY_STATUS_OTP = /* GraphQL */ `
  mutation AgentVerifyStatusOtp($companyName: String!, $contactEmail: String!, $code: String!) {
    verifyClientStatusOtp(companyName: $companyName, contactEmail: $contactEmail, code: $code) {
      status
      token
    }
  }
`;

export const CLIENT_STATUS = /* GraphQL */ `
  query AgentClientStatus($token: String!) {
    clientStatus(token: $token) {
      companyName
      applicationState
      coarseStage
      stageMessage
      ndaStatus
      engagementAgreementStatus
      preparedDocuments
      submittedRaise
      nextStep
      lastUpdated
    }
  }
`;
