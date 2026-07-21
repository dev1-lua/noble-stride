// GraphQL documents for the Investor Agent.
// The CRM returns only whitelisted ack/projection shapes — never raw records.

export const INVESTOR_BY_EMAIL = /* GraphQL */ `
  query InvestorByEmail($email: String!) {
    investorByEmail(email: $email) {
      matched
      investorId
      investorName
      contactName
    }
  }
`;

export const INVESTOR_SELF_VIEW = /* GraphQL */ `
  query InvestorSelfView($email: String!) {
    investorSelfView(email: $email) {
      matched
      investorName
      status
      onboardingStatus
      sectorFocus
      geographicFocus
      instruments
      investmentStages
      ticketBand
      currency
      targetIrr
      countryRestrictions
      esgFocus
      investmentMandate
      criteriaVerifiedAt
      decisionProcess
      shareholdingPreference
      pricingPreference
      remainingInvestmentPeriod
      ddRequirements
      icApprovalProcess
      trackRecord
      notableInvestments
      portfolioComposition
      caseStudies
      reinvestmentPolicy
      teamComposition
      collaborationTerms
      impactMetrics
      reputationalRisks
    }
  }
`;

export const MATCH_INVESTORS = /* GraphQL */ `
  query MatchInvestors($transactionId: String!) {
    matchInvestorsForTransaction(transactionId: $transactionId) {
      investorId
      name
      personId
      contactName
      contactEmail
      matchReasons
      hasExistingEngagement
    }
  }
`;

export const TEASER_CONTEXT = /* GraphQL */ `
  query TeaserContext($transactionId: String!) {
    transactionTeaserContext(transactionId: $transactionId) {
      codename
      sectors
      geographies
      dealType
      instruments
      targetRaiseBand
      revenueBand
      revenueForecastBand
      description
      contact
    }
  }
`;

export const SUBMIT_INVESTOR_UPDATE = /* GraphQL */ `
  mutation SubmitInvestorUpdate($input: InvestorUpdateSubmitInput!) {
    submitInvestorUpdate(input: $input) {
      ok
    }
  }
`;

export const LOG_COMMUNICATION = /* GraphQL */ `
  mutation LogInvestorCommunication($input: InvestorCommunicationInput!) {
    logInvestorCommunication(input: $input) {
      ok
    }
  }
`;

export const FLAG_FOR_REVIEW = /* GraphQL */ `
  mutation FlagInvestorForReview($input: InvestorFlagInput!) {
    flagInvestorForReview(input: $input) {
      ok
    }
  }
`;

export const EXPRESS_DEAL_INTEREST = /* GraphQL */ `
  mutation ExpressDealInterest($investorId: String!, $dealHint: String) {
    expressDealInterestForAgent(investorId: $investorId, dealHint: $dealHint) {
      matched
      dealName
      portalUrl
    }
  }
`;

export const SAVE_DRAFTS = /* GraphQL */ `
  mutation SaveOutreachDrafts($input: OutreachDraftsInput!) {
    saveOutreachDrafts(input: $input) {
      ok
      created
      skipped
    }
  }
`;
