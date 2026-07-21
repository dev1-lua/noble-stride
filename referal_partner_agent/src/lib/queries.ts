import type { RecordType } from "./resolve";

export const GLOBAL_SEARCH = /* GraphQL */ `
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`;

const ACTIVITY_FIELDS = `activities { type subject body occurredAt channel direction }`;
const STAGE_CHANGE_FIELDS = `stageChanges { field fromValue toValue changedAt createdSource changedBy { name } }`;
const PARTNER_AGREEMENT_FIELDS = `feeSharingAgreement feeSharingTerms partnerAgreementStatus internalOnly`;

// ── summarize_record detail queries (ported from the investor tracker) ───────

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
          referredBy { id name }
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
          partnerFeeStatus partnerFeeAmount activeConversations createdAt updatedAt ownerId
          client { id name }
          mandate { id name stage }
          referredBy { id name }
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
          ${PARTNER_AGREEMENT_FIELDS} feedbackNotes
          createdAt updatedAt
          contacts { firstName lastName email }
          referredMandates { id name stage }
          referredTransactions { id name stage }
        }
      }
    `,
  },
};

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

// ── Slim by-id lookups: globalSearch only matches names (contains), so exact
// ids from previous tool results need a direct fetch. ────────────────────────

export const PARTNER_BY_ID = /* GraphQL */ `
  query ReferralPartnerById($id: ID!) {
    partner(id: $id) { id name }
  }
`;

export const MANDATE_BY_ID = /* GraphQL */ `
  query ReferralMandateById($id: ID!) {
    mandate(id: $id) { id name }
  }
`;

export const CLIENT_BY_ID = /* GraphQL */ `
  query ReferralClientById($id: ID!) {
    client(id: $id) { id name }
  }
`;

export const TRANSACTION_BY_ID = /* GraphQL */ `
  query ReferralTransactionById($id: ID!) {
    transaction(id: $id) { id name }
  }
`;

// ── Referral / Partner Tracking documents (spec §8.4) ─────────────────────────

/**
 * Full referral picture of one partner: agreement/fee state, contacts, every
 * referred mandate (with its transactions) and directly-referred transaction,
 * plus the partner's own change history.
 */
export const PARTNER_REFERRAL_DETAIL = /* GraphQL */ `
  query ReferralPartnerDetail($id: ID!) {
    partner(id: $id) {
      id name partnerType status location organization email phone profile
      ${PARTNER_AGREEMENT_FIELDS} feedbackNotes
      createdAt updatedAt
      contacts { firstName lastName email jobTitle isPrimaryContact }
      referredMandates {
        id name stage dealStatus dealSize currency stageEnteredAt updatedAt
        client { id name }
        transactions { id name stage dealStatus targetRaise currency partnerFeeStatus partnerFeeAmount }
      }
      referredTransactions {
        id name stage dealStatus targetRaise currency partnerFeeStatus partnerFeeAmount
        mandateId
        client { id name }
      }
      ${STAGE_CHANGE_FIELDS}
    }
  }
`;

/**
 * Referral status of one mandate: originator (with agreement/fee-guard fields),
 * stage timeline, and name/clientId echoed for update round-trips
 * (MandateInput requires both even on update).
 */
export const MANDATE_REFERRAL_STATUS = /* GraphQL */ `
  query ReferralMandateStatus($id: ID!) {
    mandate(id: $id) {
      id name stage stageEnteredAt daysInStage dealStatus dealSize currency
      dateOpened createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${PARTNER_AGREEMENT_FIELDS} }
      transactions { id name stage dealStatus targetRaise currency partnerFeeStatus partnerFeeAmount }
      ${STAGE_CHANGE_FIELDS}
    }
  }
`;

/**
 * Referral status of one transaction: direct originator, parent mandate's
 * originator (fallback), fee fields, stage timeline; name/clientId echoed for
 * update round-trips (TransactionInput requires both even on update).
 */
export const TRANSACTION_REFERRAL_STATUS = /* GraphQL */ `
  query ReferralTransactionStatus($id: ID!) {
    transaction(id: $id) {
      id name stage stageEnteredAt dealStatus targetRaise currency
      partnerFeeStatus partnerFeeAmount
      dateOpened closedAt createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${PARTNER_AGREEMENT_FIELDS} }
      mandate {
        id name stage
        referredBy { id name partnerType status ${PARTNER_AGREEMENT_FIELDS} }
      }
      ${STAGE_CHANGE_FIELDS}
    }
  }
`;

/** Everything the referral scan needs, in one unpaginated sweep (fine at current scale). */
export const REFERRED_DEALS_SCAN = /* GraphQL */ `
  query ReferralDealsScan {
    partners {
      id name
      referredMandates { id name stage dealStatus updatedAt }
      referredTransactions { id name stage dealStatus mandateId updatedAt }
    }
  }
`;

/**
 * Every deal in both pipelines with its originator — powers list_deals
 * ("who introduced the latest N deals"). Same stage-column resolvers the
 * investor-tracker's pipeline snapshot uses; referredBy is null for deals
 * with no referral on record.
 */
export const DEALS_SNAPSHOT = /* GraphQL */ `
  query ReferralDealsSnapshot {
    mandatesByStage {
      stage label
      items {
        id name stage dealStatus createdAt updatedAt dateOpened currency dealSize
        referredBy { id name }
        client { id name }
      }
    }
    transactionsByStage {
      stage label
      items {
        id name stage dealStatus createdAt updatedAt dateOpened currency targetRaise
        referredBy { id name }
        client { id name }
      }
    }
  }
`;

export const PARTNER_REFERRAL_STATS = /* GraphQL */ `
  query ReferralPartnerStats {
    partnerReferralStats {
      totalPartners dealsReferred closedRevenue conversionRate
      byPartner { id name referred active closed revenue }
    }
  }
`;

// ── Referral mutations (all confirmation-gated at the tool layer) ─────────────

export const CREATE_PARTNER = /* GraphQL */ `
  mutation ReferralCreatePartner($input: PartnerInput!) {
    createPartner(input: $input) {
      id name partnerType status organization email phone
      ${PARTNER_AGREEMENT_FIELDS} updatedAt
    }
  }
`;

export const UPDATE_PARTNER = /* GraphQL */ `
  mutation ReferralUpdatePartner($id: ID!, $input: PartnerInput!) {
    updatePartner(id: $id, input: $input) {
      id name partnerType status organization email phone
      ${PARTNER_AGREEMENT_FIELDS} feedbackNotes updatedAt
    }
  }
`;

export const CREATE_MANDATE = /* GraphQL */ `
  mutation ReferralCreateMandate($input: MandateInput!) {
    createMandate(input: $input) {
      id name stage dealStatus referredById clientId updatedAt
    }
  }
`;

export const UPDATE_MANDATE = /* GraphQL */ `
  mutation ReferralUpdateMandate($id: ID!, $input: MandateInput!) {
    updateMandate(id: $id, input: $input) {
      id name stage dealStatus referredById clientId updatedAt
    }
  }
`;

export const UPDATE_TRANSACTION = /* GraphQL */ `
  mutation ReferralUpdateTransaction($id: ID!, $input: TransactionInput!) {
    updateTransaction(id: $id, input: $input) {
      id name stage dealStatus referredById partnerFeeStatus partnerFeeAmount updatedAt
    }
  }
`;

export const CREATE_TASK = /* GraphQL */ `
  mutation ReferralCreateTask($input: TaskInput!) {
    createTask(input: $input) { id title status dueAt }
  }
`;

export const LOG_ACTIVITY = /* GraphQL */ `
  mutation ReferralLogActivity($input: LogActivityInput!) {
    logActivity(input: $input) { id }
  }
`;

// ─── Partner self-service (SOW §7.2) ─────────────────────────────────────────

// Staff-only: mint (or rotate) a partner's static access code. Returns the raw
// code ONCE for out-of-band delivery to the partner.
export const ISSUE_PARTNER_ACCESS_CODE = /* GraphQL */ `
  mutation ReferralIssuePartnerAccessCode($partnerId: String!) {
    issuePartnerAccessCode(partnerId: $partnerId) { code }
  }
`;

// Partner-facing: verify a partner's access code. Returns { status, token };
// every failure collapses to status "failed" (anti-enumeration).
export const VERIFY_PARTNER_ACCESS_CODE = /* GraphQL */ `
  mutation ReferralVerifyPartnerAccessCode($partnerRef: String!, $code: String!) {
    verifyPartnerAccessCode(partnerRef: $partnerRef, code: $code) { status token }
  }
`;

// Partner-facing: the verified partner's OWN whitelisted view.
export const PARTNER_SELF_VIEW = /* GraphQL */ `
  query ReferralPartnerSelfView($token: String!) {
    partnerSelfView(token: $token) {
      name
      organization
      email
      phone
      advisorType
      feeAgreementOnFile
      referredDealCount
      referredDeals { dealName stage status }
    }
  }
`;

// Partner-facing: propose an update to the partner's OWN contact details
// (queued for staff review — never applied directly).
export const SUBMIT_PARTNER_SELF_UPDATE = /* GraphQL */ `
  mutation ReferralSubmitPartnerSelfUpdate($input: PartnerSelfUpdateInput!) {
    submitPartnerSelfUpdate(input: $input) { ok }
  }
`;
