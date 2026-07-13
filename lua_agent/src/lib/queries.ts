import type { RecordType } from "./resolve";

export const GLOBAL_SEARCH = /* GraphQL */ `
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`;

const ACTIVITY_FIELDS = `activities { type subject body occurredAt channel direction }`;

export const DETAIL_QUERIES: Record<RecordType, { document: string; rootField: string }> = {
  client: {
    rootField: "client",
    document: /* GraphQL */ `
      query AgentClient($id: ID!) {
        client(id: $id) {
          id name sector status hqCity hqCountry website description
          revenueLastYear revenueForecast currency profitability existingInvestors staffCount
          createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          mandates { id name stage dealSize currency nextAction stageEnteredAt }
          transactions { id name stage targetRaise currency dealStatus stageEnteredAt }
          ${ACTIVITY_FIELDS}
        }
      }
    `,
  },
  investor: {
    rootField: "investor",
    document: /* GraphQL */ `
      query AgentInvestor($id: ID!) {
        investor(id: $id) {
          id name investorType status website sectorFocus geographicFocus instruments
          investmentStages aum ticketMin ticketMax currency esgFocus ndaStatus onboardingStatus
          engagementClassification nextActionDate feedback notes createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          engagements {
            id name status engagementStage interestLevel lastContact totalAmount probability
            transaction { id name stage }
          }
          ${ACTIVITY_FIELDS}
        }
      }
    `,
  },
  mandate: {
    rootField: "mandate",
    document: /* GraphQL */ `
      query AgentMandate($id: ID!) {
        mandate(id: $id) {
          id name stage stageEnteredAt daysInStage dealStatus dealSize currency sector source
          dateOpened ndaStatus ndaSignedDate eaStatus eaSignedDate nextAction notes
          retainerAmount priority createdAt updatedAt leadId
          client { id name }
          transactions { id name stage }
          ${ACTIVITY_FIELDS}
        }
      }
    `,
  },
  transaction: {
    rootField: "transaction",
    document: /* GraphQL */ `
      query AgentTransaction($id: ID!) {
        transaction(id: $id) {
          id name stage stageEnteredAt dealType instrument targetRaise currency sector
          dateOpened closedAt dealStatus dealMilestone financingType probability notes priority
          activeConversations createdAt updatedAt ownerId
          client { id name }
          mandate { id name stage }
          engagements {
            id name status engagementStage interestLevel lastContact totalAmount termSheetIssued
            investor { id name }
          }
          ${ACTIVITY_FIELDS}
        }
      }
    `,
  },
  engagement: {
    rootField: "engagement",
    document: /* GraphQL */ `
      query AgentEngagement($id: ID!) {
        engagement(id: $id) {
          id name status engagementStage interestLevel ndaType ndaSignedAt termSheetIssued termSheetDate
          totalAmount amountDisbursed amountPending disbursementStatus probability feedback notes
          lastContact createdAt updatedAt
          transaction { id name stage client { id name } }
          investor { id name investorType }
          milestones { key completedAt notes }
          ${ACTIVITY_FIELDS}
        }
      }
    `,
  },
  partner: {
    rootField: "partner",
    document: /* GraphQL */ `
      query AgentPartner($id: ID!) {
        partner(id: $id) {
          id name partnerType status location organization email phone profile
          feeSharingAgreement feeSharingTerms partnerAgreementStatus internalOnly feedbackNotes
          createdAt updatedAt
          contacts { firstName lastName email }
          referredMandates { id name stage }
        }
      }
    `,
  },
};

export const PIPELINE_SNAPSHOT = /* GraphQL */ `
  query AgentPipelineSnapshot {
    mandatesByStage {
      stage label
      items { id name stageEnteredAt createdAt updatedAt dateOpened currency dealSize }
    }
    transactionsByStage {
      stage label
      items { id name stageEnteredAt createdAt updatedAt dateOpened currency targetRaise }
    }
  }
`;

/** Document METADATA only — never file contents (spec §4.1). */
export const DOCUMENTS_QUERY = /* GraphQL */ `
  query AgentDocuments($clientId: ID, $investorId: ID, $mandateId: ID, $transactionId: ID) {
    documents(clientId: $clientId, investorId: $investorId, mandateId: $mandateId, transactionId: $transactionId) {
      name type status accessLevel uploadedAt isCurrent
    }
  }
`;

/** Which documents() filter arg each summarizable type uses (engagement/partner have none). */
export const DOCUMENT_ARG: Partial<Record<RecordType, string>> = {
  client: "clientId",
  investor: "investorId",
  mandate: "mandateId",
  transaction: "transactionId",
};
