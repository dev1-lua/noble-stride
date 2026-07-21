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
    advisoryByStage {
      stage label
      items { id name stageEnteredAt createdAt updatedAt dateOpened currency feeAmount }
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

// ── Investor Tracker documents (spec §8.3) ────────────────────────────────────

/**
 * Full tracking picture of one investor-deal engagement: stage, NDA, term sheet,
 * money, the 15-key milestone checklist, the transaction's DD tracks, and the
 * investor's classification (drives the excluded/greylisted guard).
 */
export const ENGAGEMENT_TRACKER_DETAIL = /* GraphQL */ `
  query TrackerEngagement($id: ID!) {
    engagement(id: $id) {
      id name status engagementStage interestLevel ndaType ndaSignedAt
      termSheetIssued termSheetDate totalAmount amountDisbursed amountPending
      disbursementStatus dateReceived probability feedback notes
      lastContact createdAt updatedAt transactionId investorId
      transaction {
        id name stage dealStatus
        client { id name }
        ddTracks { track status notes startedAt completedAt }
      }
      investor { id name investorType engagementClassification ndaStatus }
      milestones { key completedAt notes }
      ${ACTIVITY_FIELDS}
    }
  }
`;

/** Everything the staleness scan needs, in one unpaginated sweep (fine at current scale). */
export const ENGAGEMENTS_BY_DEAL_SCAN = /* GraphQL */ `
  query TrackerEngagementsByDeal {
    engagementsByDeal {
      transaction { id name stage dealStatus client { id name } }
      engagements {
        id name engagementStage interestLevel lastContact updatedAt
        termSheetIssued termSheetDate totalAmount amountDisbursed amountPending
        disbursementStatus
        investor { id name engagementClassification }
      }
    }
  }
`;

/**
 * Stage-change audit trail for one engagement (spec §7.1). The StageChange model
 * is append-only; `field` distinguishes stage moves ("engagementStage") from other
 * tracked transitions. Ordered changedAt-desc by the CRM.
 */
export const ENGAGEMENT_STAGE_HISTORY = /* GraphQL */ `
  query TrackerEngagementHistory($id: ID!) {
    engagement(id: $id) {
      id name engagementStage
      transaction { id name }
      investor { id name }
      stageChanges { field fromValue toValue changedAt createdSource changedBy { id name } }
    }
  }
`;

// Slim by-id lookups: globalSearch only matches names (contains), so exact ids
// from previous tool results need a direct fetch.
export const TRANSACTION_BY_ID = /* GraphQL */ `
  query TrackerTransactionById($id: ID!) {
    transaction(id: $id) { id name }
  }
`;

export const INVESTOR_BY_ID = /* GraphQL */ `
  query TrackerInvestorById($id: ID!) {
    investor(id: $id) { id name }
  }
`;

export const TRANSACTION_DD_TRACKS = /* GraphQL */ `
  query TrackerDdTracks($id: ID!) {
    transaction(id: $id) {
      id
      ddTracks { track status notes startedAt completedAt }
    }
  }
`;

/**
 * Outreach draft lifecycle (written by the investor-outreach agent, reviewed by
 * staff in the CRM's /outreach queue). Read-only here — all statuses, newest first.
 */
export const OUTREACH_DRAFTS = /* GraphQL */ `
  query TrackerOutreachDrafts($transactionId: ID, $investorId: ID) {
    outreachDrafts(filter: { transactionId: $transactionId, investorId: $investorId }) {
      id subject status matchRationale error sentAt reviewedAt createdAt
      investor { id name }
      transaction { id name }
      person { firstName lastName email }
    }
  }
`;

/** Org-wide KPI snapshot: dashboard stats + stage counts + 6-month trend, in one round trip. */
export const DASHBOARD_SNAPSHOT = /* GraphQL */ `
  query TrackerDashboardSnapshot {
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
    dealPipelineTrend { month active closed }
  }
`;

export const AI_MATCH_INVESTORS = /* GraphQL */ `
  query TrackerMatchInvestors($transactionId: ID!) {
    aiMatchInvestors(transactionId: $transactionId) {
      id name score reasons warnings contactName criteriaStale
    }
  }
`;

// ── Tracker mutations (all confirmation-gated at the tool layer) ──────────────

export const UPDATE_ENGAGEMENT = /* GraphQL */ `
  mutation TrackerUpdateEngagement($id: ID!, $input: EngagementInput!) {
    updateEngagement(id: $id, input: $input) {
      id name engagementStage interestLevel ndaType termSheetIssued termSheetDate
      totalAmount amountDisbursed amountPending disbursementStatus probability updatedAt
    }
  }
`;

export const RECORD_MILESTONE = /* GraphQL */ `
  mutation TrackerRecordMilestone($input: MilestoneInput!) {
    recordMilestone(input: $input) { id key completedAt notes }
  }
`;

export const UNRECORD_MILESTONE = /* GraphQL */ `
  mutation TrackerUnrecordMilestone($engagementId: ID!, $key: MilestoneKey!) {
    unrecordMilestone(engagementId: $engagementId, key: $key)
  }
`;

export const UPSERT_DD_TRACK = /* GraphQL */ `
  mutation TrackerUpsertDdTrack($input: DueDiligenceTrackInput!) {
    upsertDueDiligenceTrack(input: $input) { id track status notes startedAt completedAt }
  }
`;

export const CREATE_TASK = /* GraphQL */ `
  mutation TrackerCreateTask($input: TaskInput!) {
    createTask(input: $input) { id title status dueAt }
  }
`;

export const LOG_ACTIVITY = /* GraphQL */ `
  mutation TrackerLogActivity($input: LogActivityInput!) {
    logActivity(input: $input) { id }
  }
`;
