var T=Object.defineProperty;var x=Object.getOwnPropertyDescriptor;var N=Object.getOwnPropertyNames;var P=Object.prototype.hasOwnProperty;var w=(n,e)=>{for(var r in e)T(n,r,{get:e[r],enumerable:!0})},F=(n,e,r,o)=>{if(e&&typeof e=="object"||typeof e=="function")for(let m of N(e))!P.call(n,m)&&m!==r&&T(n,m,{get:()=>e[m],enumerable:!(o=x(e,m))||o.enumerable});return n};var M=n=>F(T({},"__esModule",{value:!0}),n);var O={};w(O,{UpdatePartnerTool:()=>y,default:()=>U});module.exports=M(O);var t=require("zod");var f="The CRM didn't respond \u2014 please try again in a minute.",i=class extends Error{constructor(e,r){super(e),this.name="CrmError",this.detail=r}};function k(n){let{apiUrl:e,agentKey:r}=n,o=n.fetchFn??fetch;return{baseUrl:e.replace(/\/api\/graphql\/?$/,""),async query(d,g){let l;try{l=await o(e,{method:"POST",headers:{"content-type":"application/json","x-agent-key":r},body:JSON.stringify({query:d,variables:g})})}catch(a){throw new i(f,a instanceof Error?a.message:String(a))}if(!l.ok)throw new i(f,`HTTP ${l.status}`);let s;try{s=await l.json()}catch(a){throw new i(f,`invalid JSON response: ${a instanceof Error?a.message:String(a)}`)}if(s.errors?.length)throw new i(`The CRM rejected the request: ${s.errors.map(a=>a.message).join("; ")}`);if(s.data===void 0||s.data===null)throw new i(f,"empty data");return s.data}}}function $(){let n=env("CRM_API_URL"),e=env("CRM_AGENT_KEY");if(!n)throw new i("Agent misconfigured: CRM_API_URL is not set.");if(!e)throw new i("Agent misconfigured: CRM_AGENT_KEY is not set.");return k({apiUrl:n,agentKey:e})}var A="activities { type subject body occurredAt channel direction }",S="stageChanges { field fromValue toValue changedAt createdSource changedBy { name } }",p="feeSharingAgreement feeSharingTerms partnerAgreementStatus internalOnly",G={client:{rootField:"client",document:`
      query AgentClient($id: ID!) {
        client(id: $id) {
          id name sector status hqCity hqCountry website description
          revenueLastYear revenueForecast currency profitability existingInvestors staffCount
          createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          mandates { id name stage dealSize currency nextAction stageEnteredAt }
          transactions { id name stage targetRaise currency dealStatus stageEnteredAt }
          ${A}
        }
      }
    `},investor:{rootField:"investor",document:`
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
          ${A}
        }
      }
    `},mandate:{rootField:"mandate",document:`
      query AgentMandate($id: ID!) {
        mandate(id: $id) {
          id name stage stageEnteredAt daysInStage dealStatus dealSize currency sector source
          dateOpened ndaStatus ndaSignedDate eaStatus eaSignedDate nextAction notes
          retainerAmount priority createdAt updatedAt leadId
          client { id name }
          referredBy { id name }
          transactions { id name stage }
          ${A}
        }
      }
    `},transaction:{rootField:"transaction",document:`
      query AgentTransaction($id: ID!) {
        transaction(id: $id) {
          id name stage stageEnteredAt dealType instrument targetRaise currency sector
          dateOpened closedAt dealStatus dealMilestone financingType probability notes priority
          partnerFeeStatus partnerFeeAmount activeConversations createdAt updatedAt ownerId
          client { id name }
          mandate { id name stage }
          referredBy { id name }
          ${A}
        }
      }
    `},engagement:{rootField:"engagement",document:`
      query AgentEngagement($id: ID!) {
        engagement(id: $id) {
          id name status engagementStage interestLevel ndaType ndaSignedAt termSheetIssued termSheetDate
          totalAmount amountDisbursed amountPending disbursementStatus probability feedback notes
          lastContact createdAt updatedAt
          transaction { id name stage client { id name } }
          investor { id name investorType }
          milestones { key completedAt notes }
          ${A}
        }
      }
    `},partner:{rootField:"partner",document:`
      query AgentPartner($id: ID!) {
        partner(id: $id) {
          id name partnerType status location organization email phone profile
          ${p} feedbackNotes
          createdAt updatedAt
          contacts { firstName lastName email }
          referredMandates { id name stage }
          referredTransactions { id name stage }
        }
      }
    `}};var E=`
  query ReferralPartnerDetail($id: ID!) {
    partner(id: $id) {
      id name partnerType status location organization email phone profile
      ${p} feedbackNotes
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
      ${S}
    }
  }
`,z=`
  query ReferralMandateStatus($id: ID!) {
    mandate(id: $id) {
      id name stage stageEnteredAt daysInStage dealStatus dealSize currency
      dateOpened createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${p} }
      transactions { id name stage dealStatus targetRaise currency partnerFeeStatus partnerFeeAmount }
      ${S}
    }
  }
`,Y=`
  query ReferralTransactionStatus($id: ID!) {
    transaction(id: $id) {
      id name stage stageEnteredAt dealStatus targetRaise currency
      partnerFeeStatus partnerFeeAmount
      dateOpened closedAt createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${p} }
      mandate {
        id name stage
        referredBy { id name partnerType status ${p} }
      }
      ${S}
    }
  }
`;var K=`
  mutation ReferralCreatePartner($input: PartnerInput!) {
    createPartner(input: $input) {
      id name partnerType status organization email phone
      ${p} updatedAt
    }
  }
`,_=`
  mutation ReferralUpdatePartner($id: ID!, $input: PartnerInput!) {
    updatePartner(id: $id, input: $input) {
      id name partnerType status organization email phone
      ${p} feedbackNotes updatedAt
    }
  }
`;var b=`
  mutation ReferralLogActivity($input: LogActivityInput!) {
    logActivity(input: $input) { id }
  }
`;var q=t.z.object({name:t.z.string().min(1).optional(),partnerType:t.z.enum(["LawFirm","Auditor","Advisor","Bank","InvestmentBank","Consulting","Other"]).optional(),advisorType:t.z.enum(["Lawyer","Investor","Consultant","TransactionAdvisor","AdvisoryFirm","Other"]).optional(),status:t.z.enum(["Active","Preferred","Inactive"]).optional(),location:t.z.string().optional(),organization:t.z.string().optional(),email:t.z.string().optional(),phone:t.z.string().optional(),profile:t.z.string().optional(),feeSharingAgreement:t.z.boolean().optional().describe("Whether a fee-sharing agreement exists with this partner"),feeSharingTerms:t.z.string().optional().describe("The agreed fee-sharing terms, e.g. '2% of closed transaction value'"),partnerAgreementStatus:t.z.enum(["None","Sent","Signed"]).optional(),internalOnly:t.z.boolean().optional().describe("Partner identity must never reach investors \u2014 this marks the record internal-only"),feedbackNotes:t.z.string().optional().describe("Internal feedback about working with this partner \u2014 never shared externally"),amount:t.z.number().nonnegative().optional(),currency:t.z.string().optional()}).refine(n=>Object.values(n).some(e=>e!==void 0),{message:"set must change at least one field"}),C=t.z.object({partnerId:t.z.string().min(1).describe("Exact partner id from a prior get_partner_profile or candidates list"),set:q.describe("Only the fields to change"),reason:t.z.string().min(1).describe("One line explaining the change \u2014 written to the CRM audit trail"),confirmed:t.z.literal(!0).describe("Only pass true after the user has explicitly confirmed this exact change in this conversation. If you have not asked yet, ask first \u2014 do not call this tool.")}),y=class{constructor(e){this.deps=e}deps;name="update_partner";description="Update one partner record: contact/profile details, status, fee-sharing agreement and terms, agreement status, internal-only flag, feedback notes. This is also how a signed fee-sharing agreement gets recorded. REQUIRES prior user confirmation of the exact change.";inputSchema=C;async execute(e){let r=C.safeParse(e);if(!r.success)return{status:"rejected",message:`Invalid input: ${r.error.issues[0]?.message??"schema mismatch"}. Writes require confirmed: true after explicit user approval.`};let o=this.deps?.crm??$(),d=(await o.query(E,{id:e.partnerId})).partner;if(!d)return{status:"not_found",message:"The partner could not be loaded from the CRM."};let g=Object.fromEntries(Object.entries(e.set).filter(([,c])=>c!==void 0)),l;try{l=(await o.query(_,{id:e.partnerId,input:{name:d.name,...g}})).updatePartner}catch(c){if(c instanceof i&&c.message!==f)return{status:"blocked",message:c.message};throw c}let s={feeSharingAgreement:g.feeSharingAgreement??d.feeSharingAgreement,feeSharingTerms:g.feeSharingTerms??d.feeSharingTerms},a=s.feeSharingAgreement&&(!s.feeSharingTerms||String(s.feeSharingTerms).trim()==="")?"The partner now has feeSharingAgreement: true but no feeSharingTerms recorded \u2014 suggest adding the agreed terms.":void 0,I=!1,h=d.referredMandates[0]?.id,R=d.referredTransactions[0]?.id;if(h||R)try{let c=Object.entries(g).map(([v,D])=>`${v} \u2192 ${String(D)}`).join(", ");await o.query(b,{input:{type:"Note",subject:"Referral Partner Agent: partner updated",body:`${e.reason}
Partner: ${d.name}
Changed: ${c}`,...h?{mandateId:h}:{transactionId:R}}}),I=!0}catch{}return{status:"ok",updated:l,...a?{warning:a}:{},auditLogged:I,link:`${o.baseUrl}/partners/${e.partnerId}`}}};var u=new y,L={version:"2.0.0",kind:"tool",name:"update_partner",description:"Update one partner record: contact/profile details, status, fee-sharing agreement and terms, agreement status, internal-only flag, feedback notes. This is also how a signed fee-sharing agreement gets recorded. REQUIRES prior user confirmation of the exact change.",exportName:"UpdatePartnerTool",pattern:"class-definition"},U={__lua_primitive__:L,primitive:{kind:"tool",name:u.name??"update_partner",description:u.description??"Update one partner record: contact/profile details, status, fee-sharing agreement and terms, agreement status, internal-only flag, feedback notes. This is also how a signed fee-sharing agreement gets recorded. REQUIRES prior user confirmation of the exact change.",inputSchema:u.inputSchema,execute:typeof u.execute=="function"?u.execute.bind(u):void 0,condition:typeof u.condition=="function"?u.condition.bind(u):void 0}};0&&(module.exports={UpdatePartnerTool});
