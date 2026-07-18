var A=Object.defineProperty;var C=Object.getOwnPropertyDescriptor;var _=Object.getOwnPropertyNames;var R=Object.prototype.hasOwnProperty;var $=(t,e)=>{for(var a in e)A(t,a,{get:e[a],enumerable:!0})},k=(t,e,a,s)=>{if(e&&typeof e=="object"||typeof e=="function")for(let u of _(e))!R.call(t,u)&&u!==a&&A(t,u,{get:()=>e[u],enumerable:!(s=C(e,u))||s.enumerable});return t};var x=t=>k(A({},"__esModule",{value:!0}),t);var U={};$(U,{UpdateEngagementTool:()=>y,default:()=>G});module.exports=x(U);var n=require("zod");var l="The CRM didn't respond \u2014 please try again in a minute.",o=class extends Error{constructor(e,a){super(e),this.name="CrmError",this.detail=a}};function N(t){let{apiUrl:e,agentKey:a}=t,s=t.fetchFn??fetch;return{baseUrl:e.replace(/\/api\/graphql\/?$/,""),async query(i,f){let g;try{g=await s(e,{method:"POST",headers:{"content-type":"application/json","x-agent-key":a},body:JSON.stringify({query:i,variables:f})})}catch(r){throw new o(l,r instanceof Error?r.message:String(r))}if(!g.ok)throw new o(l,`HTTP ${g.status}`);let d;try{d=await g.json()}catch(r){throw new o(l,`invalid JSON response: ${r instanceof Error?r.message:String(r)}`)}if(d.errors?.length)throw new o(`The CRM rejected the request: ${d.errors.map(r=>r.message).join("; ")}`);if(d.data===void 0||d.data===null)throw new o(l,"empty data");return d.data}}}function I(){let t=env("CRM_API_URL"),e=env("CRM_AGENT_KEY");if(!t)throw new o("Agent misconfigured: CRM_API_URL is not set.");if(!e)throw new o("Agent misconfigured: CRM_AGENT_KEY is not set.");return N({apiUrl:t,agentKey:e})}var p="activities { type subject body occurredAt channel direction }",j={client:{rootField:"client",document:`
      query AgentClient($id: ID!) {
        client(id: $id) {
          id name sector status hqCity hqCountry website description
          revenueLastYear revenueForecast currency profitability existingInvestors staffCount
          createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          mandates { id name stage dealSize currency nextAction stageEnteredAt }
          transactions { id name stage targetRaise currency dealStatus stageEnteredAt }
          ${p}
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
          ${p}
        }
      }
    `},mandate:{rootField:"mandate",document:`
      query AgentMandate($id: ID!) {
        mandate(id: $id) {
          id name stage stageEnteredAt daysInStage dealStatus dealSize currency sector source
          dateOpened ndaStatus ndaSignedDate eaStatus eaSignedDate nextAction notes
          retainerAmount priority createdAt updatedAt leadId
          client { id name }
          transactions { id name stage }
          ${p}
        }
      }
    `},transaction:{rootField:"transaction",document:`
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
          ${p}
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
          ${p}
        }
      }
    `},partner:{rootField:"partner",document:`
      query AgentPartner($id: ID!) {
        partner(id: $id) {
          id name partnerType status location organization email phone profile
          feeSharingAgreement feeSharingTerms partnerAgreementStatus internalOnly feedbackNotes
          createdAt updatedAt
          contacts { firstName lastName email }
          referredMandates { id name stage }
        }
      }
    `}};var S=`
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
      ${p}
    }
  }
`;var h=`
  mutation TrackerUpdateEngagement($id: ID!, $input: EngagementInput!) {
    updateEngagement(id: $id, input: $input) {
      id name engagementStage interestLevel ndaType termSheetIssued termSheetDate
      totalAmount amountDisbursed amountPending disbursementStatus probability updatedAt
    }
  }
`;var b=`
  mutation TrackerLogActivity($input: LogActivityInput!) {
    logActivity(input: $input) { id }
  }
`;var w=new Set(["Excluded","Greylisted"]),O=new Set(["Declined"]),M=new Set(["FellOff","Dropped"]);function T(t,e){let a=t.engagementClassification;if(!a||!w.has(a))return{allowed:!0};if(e){let s=Object.keys(e).filter(i=>e[i]!==void 0);if(s.length>0&&s.every(i=>i==="engagementStage"&&O.has(String(e.engagementStage))||i==="disbursementStatus"&&M.has(String(e.disbursementStatus))))return{allowed:!0}}return{allowed:!1,message:`${t.name} is classified ${a} \u2014 this engagement cannot be advanced or updated. Only recording a decline or a fell-off/dropped disbursement is permitted. Ask an admin to review the investor's classification if this seems wrong.`}}var q=n.z.object({engagementStage:n.z.enum(["Shared","TeaserSent","NDASigned","IMShared","VDRAccess","Meeting","InfoRequest","DueDiligence","TermSheet","Offer","Invested","Declined"]).optional().describe("New engagement stage. Advancing past NDA-gated stages requires an NDA on record \u2014 the CRM enforces this."),interestLevel:n.z.enum(["Low","Medium","High"]).optional(),ndaType:n.z.enum(["Open","Closed"]).optional().describe("Records which NDA covers this engagement"),termSheetIssued:n.z.boolean().optional().describe("Whether a term sheet has been issued \u2014 status only, never the terms themselves"),termSheetDate:n.z.string().optional().describe("ISO date the term sheet was issued/received"),totalAmount:n.z.number().nonnegative().optional().describe("Total committed amount"),amountDisbursed:n.z.number().nonnegative().optional().describe("Amount disbursed to date"),disbursementStatus:n.z.enum(["Disbursed","Ongoing","FellOff","Dropped"]).optional(),dateReceived:n.z.string().optional().describe("ISO date funds were received"),probability:n.z.number().int().min(0).max(100).optional(),feedback:n.z.string().optional().describe("Investor feedback to record"),notes:n.z.string().optional()}).refine(t=>Object.values(t).some(e=>e!==void 0),{message:"set must change at least one field"}),E=n.z.object({engagementId:n.z.string().min(1).describe("From a prior get_engagement_status or scan call"),set:q.describe("Only the fields to change"),reason:n.z.string().min(1).describe("One line explaining the change \u2014 written to the CRM audit trail"),confirmed:n.z.literal(!0).describe("Only pass true after the user has explicitly confirmed this exact change in this conversation. If you have not asked yet, ask first \u2014 do not call this tool.")}),y=class{constructor(e){this.deps=e}deps;name="update_engagement";description="Update one investor-deal engagement: stage, interest, NDA type, term-sheet status/date, amounts, disbursement, probability, feedback. REQUIRES prior user confirmation of the exact change. Records facts only \u2014 never drafts, issues, or accepts commercial terms, and cannot grant VDR or data-room access. Every update is logged to the CRM activity trail.";inputSchema=E;async execute(e){let a=E.safeParse(e);if(!a.success)return{status:"rejected",message:`Invalid input: ${a.error.issues[0]?.message??"schema mismatch"}. Writes require confirmed: true after explicit user approval.`};let s=this.deps?.crm??I(),i=(await s.query(S,{id:e.engagementId})).engagement;if(!i)return{status:"not_found",message:"The engagement could not be loaded from the CRM."};let f=T(i.investor,e.set);if(!f.allowed)return{status:"refused",message:f.message};let g=Object.fromEntries(Object.entries(e.set).filter(([,c])=>c!==void 0)),d;try{d=(await s.query(h,{id:e.engagementId,input:{transactionId:i.transactionId,investorId:i.investorId,...g}})).updateEngagement}catch(c){if(c instanceof o&&c.message!==l)return{status:"blocked",message:c.message};throw c}let r=!0;try{let c=Object.entries(g).map(([v,D])=>`${v} \u2192 ${String(D)}`).join(", ");await s.query(b,{input:{type:"Note",subject:"Investor Tracker Agent update",body:`${e.reason}
Changed: ${c}`,engagementId:e.engagementId}})}catch{r=!1}return{status:"ok",updated:d,auditLogged:r,link:`${s.baseUrl}/engagement/${e.engagementId}`}}};var m=new y,L={version:"2.0.0",kind:"tool",name:"update_engagement",description:"Update one investor-deal engagement: stage, interest, NDA type, term-sheet status/date, amounts, disbursement, probability, feedback. REQUIRES prior user confirmation of the exact change. Records facts only \u2014 never drafts, issues, or accepts commercial terms, and cannot grant VDR or data-room access. Every update is logged to the CRM activity trail.",exportName:"UpdateEngagementTool",pattern:"class-definition"},G={__lua_primitive__:L,primitive:{kind:"tool",name:m.name??"update_engagement",description:m.description??"Update one investor-deal engagement: stage, interest, NDA type, term-sheet status/date, amounts, disbursement, probability, feedback. REQUIRES prior user confirmation of the exact change. Records facts only \u2014 never drafts, issues, or accepts commercial terms, and cannot grant VDR or data-room access. Every update is logged to the CRM activity trail.",inputSchema:m.inputSchema,execute:typeof m.execute=="function"?m.execute.bind(m):void 0,condition:typeof m.condition=="function"?m.condition.bind(m):void 0}};0&&(module.exports={UpdateEngagementTool});
