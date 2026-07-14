// GraphQL documents for the Client Agent. The server returns ONLY the
// minimal ack/enum fields selected here — never record data (see
// noblestride-crm/src/server/services/client-intake.ts).

export const CHECK_COMPANY = /* GraphQL */ `
  query AgentCheckCompany($name: String!, $contactEmail: String) {
    checkCompany(name: $name, contactEmail: $contactEmail) {
      status
    }
  }
`;

export const SUBMIT_CLIENT_INTAKE = /* GraphQL */ `
  mutation AgentSubmitClientIntake($input: ClientIntakeInput!) {
    submitClientIntake(input: $input) {
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
