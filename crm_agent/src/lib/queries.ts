import type { RecordType } from "./resolve";

export const RESOLVE_STAFF_USER = /* GraphQL */ `
  query AgentResolveStaffUser($email: String!) {
    resolveStaffUser(email: $email) { ok firstName }
  }
`;

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
          countries coreProduct businessModel ownershipStructure branchCount
          ebitda netProfit existingDebt totalAssets raisedToDateTotal pepExposure governmentOwned
          createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          mandates { id name stage dealSize currency nextAction stageEnteredAt }
          transactions { id name stage targetRaise currency dealStatus stageEnteredAt }
          tasks { title status dueAt }
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
          targetIrr shareholdingPreference minRevenue minEbitda pricingPreference
          ddRequirements icApprovalProcess trackRecord investmentMandate reinvestmentPolicy
          registeredAt criteriaVerifiedAt openNdaSignedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          engagements {
            id name status engagementStage interestLevel lastContact totalAmount probability
            transaction { id name stage }
          }
          tasks { title status dueAt }
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
          retainerAmount priority createdAt updatedAt
          lead { id name }
          referralQualified qualificationVerdict qualifiedAt intakeNdaAccepted
          client { id name }
          transactions { id name stage }
          stageChanges { field fromValue toValue changedAt }
          tasks { title status dueAt }
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
          activeConversations createdAt updatedAt
          owner { id name }
          assistant { id name }
          maxSellingStake useOfFunds targetProfile partnerFeeStatus
          client { id name }
          mandate { id name stage }
          engagements {
            id name status engagementStage interestLevel lastContact totalAmount termSheetIssued
            investor { id name }
          }
          stageChanges { field fromValue toValue changedAt }
          serviceProviders { id name }
          tasks { title status dueAt }
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
          year quarter dateReceived
          transaction { id name stage client { id name } }
          investor { id name investorType }
          milestones { key completedAt notes }
          stageChanges { field fromValue toValue changedAt }
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
          amount currency advisorType
          createdAt updatedAt
          contacts { firstName lastName email }
          referredMandates { id name stage }
          referredTransactions { id name stage }
          stageChanges { field fromValue toValue changedAt }
        }
      }
    `,
  },
};

export const PIPELINE_SNAPSHOT = /* GraphQL */ `
  query AgentPipelineSnapshot {
    mandatesByStage {
      stage label
      items { id name stageEnteredAt createdAt updatedAt dateOpened currency dealSize sector lead { name } }
    }
    transactionsByStage {
      stage label
      items { id name stageEnteredAt createdAt updatedAt dateOpened currency targetRaise sector owner { name } }
    }
  }
`;

/** Reuses the CRM's existing agent-gated matcher (assertAutomation). Read-only. */
export const MATCH_INVESTORS = /* GraphQL */ `
  query AgentMatchInvestors($transactionId: String!) {
    matchInvestorsForTransaction(transactionId: $transactionId) {
      investorId name contactName matchReasons hasExistingEngagement
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

// ─── summarize_investor_document (Task 5) ───────────────────────────────────
// A whitelisted, extraction-only surface: documentAgentText is the ONLY
// place crmAgent ever reads a document's file contents (DOCUMENTS_QUERY
// above stays metadata-only). List an investor's own documents to resolve
// a named or "latest" pick, then fetch that one document's extracted text.

// createdSource is selected and filtered client-side (kept to "API" only) so
// this tool can only ever pick a document the investor uploaded through
// their own portal — never a staff- or agent-filed document on the same
// investor record (C1/I1).
export const LIST_INVESTOR_DOCUMENTS = /* GraphQL */ `
  query AgentInvestorDocuments($investorId: ID!) {
    documents(investorId: $investorId) {
      id
      name
      type
      uploadedAt
      isCurrent
      createdSource
    }
  }
`;

export const DOCUMENT_AGENT_TEXT = /* GraphQL */ `
  query AgentDocumentText($id: ID!) {
    documentAgentText(id: $id) {
      name
      mimeType
      text
      truncated
    }
  }
`;

/** Stated CRM criteria for an investor — the fields a document is checked against. */
export const INVESTOR_CRITERIA = /* GraphQL */ `
  query AgentInvestorCriteria($id: ID!) {
    investor(id: $id) {
      name
      sectorFocus
      geographicFocus
      instruments
      investmentStages
      ticketMin
      ticketMax
      currency
      ticketBands {
        min
        max
        currency
        note
      }
      minRevenue
      minEbitda
      minLoanBook
      targetIrr
      esgFocus
      investmentMandate
    }
  }
`;

// ─── crmAgent write surface (Task 9/10) ─────────────────────────────────────
// Two-phase prepare/confirm write mutations. Never expose raw record fields
// back to the model beyond the operator-facing preview/summary text.

export const AGENT_PREPARE_WRITE = /* GraphQL */ `
  mutation AgentPrepareWrite($operation: String!, $targetId: String, $payloadJson: String!, $actorEmail: String!) {
    agentPrepareWrite(operation: $operation, targetId: $targetId, payloadJson: $payloadJson, actorEmail: $actorEmail) {
      writeToken
      preview
      warnings
    }
  }
`;

export const AGENT_COMMIT_WRITE = /* GraphQL */ `
  mutation AgentCommitWrite($writeToken: String!, $actorEmail: String!) {
    agentCommitWrite(writeToken: $writeToken, actorEmail: $actorEmail) {
      ok
      summary
      recordId
      href
    }
  }
`;

export const AGENT_CANCEL_WRITE = /* GraphQL */ `
  mutation AgentCancelWrite($writeToken: String!, $actorEmail: String!) {
    agentCancelWrite(writeToken: $writeToken, actorEmail: $actorEmail) {
      ok
    }
  }
`;

/** Per-deal investor interest snapshot (Task 2 `list_deal_interest`): every
 * engagement's status/stage/milestones on one transaction. Deliberately does
 * NOT select `activities` (unbounded relation) — this tool only needs status,
 * freshness, and milestone facts, all already on the Engagement type. */
export const AGENT_DEAL_INTEREST = /* GraphQL */ `
  query AgentDealInterest($id: ID!) {
    transaction(id: $id) {
      id name stage
      engagements {
        status engagementStage interestLevel lastContact updatedAt
        investor { id name investorType }
        conversation { status lastMessageAt }
        milestones { key completedAt }
      }
    }
  }
`;

// Investor roster for classification lookups (e.g. greylisted/excluded). The
// server filter has no engagementClassification arg, so the tool fetches a
// bounded page and filters client-side. pageSize is generous because the
// classified subset is small.
export const LIST_INVESTORS = /* GraphQL */ `
  query AgentListInvestors($page: Int!, $pageSize: Int!) {
    investors(page: $page, pageSize: $pageSize) {
      id
      name
      engagementClassification
      investorType
    }
  }
`;

// A3 / F5.3 (image20): org-level counts behind crm_overview. Copied
// field-for-field from the query the tracker already runs successfully
// (investor-tracker-agent DASHBOARD_SNAPSHOT), minus the trend, plus
// investorsCount.
//
// PipelineOverview exposes ONLY the two stage arrays — its service also computes
// mandatesActive/transactionsActive, but those are not on the GraphQL type — so
// the active subset comes from dashboardStats instead.
export const CRM_OVERVIEW = /* GraphQL */ `
  query AgentCrmOverview {
    dashboardStats {
      activeMandates { value delta }
      activeTransactions { value delta }
      investorsEngagedQtr { value delta }
      capitalRaisedYtd { value delta }
    }
    pipelineOverview {
      mandatesByStage { stage label count }
      transactionsByStage { stage label count }
    }
    investorsCount
  }
`;
