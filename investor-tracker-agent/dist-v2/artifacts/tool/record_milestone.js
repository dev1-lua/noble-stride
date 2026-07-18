var A=Object.defineProperty;var C=Object.getOwnPropertyDescriptor;var D=Object.getOwnPropertyNames;var _=Object.prototype.hasOwnProperty;var R=(t,e)=>{for(var n in e)A(t,n,{get:e[n],enumerable:!0})},$=(t,e,n,a)=>{if(e&&typeof e=="object"||typeof e=="function")for(let c of D(e))!_.call(t,c)&&c!==n&&A(t,c,{get:()=>e[c],enumerable:!(a=C(e,c))||a.enumerable});return t};var k=t=>$(A({},"__esModule",{value:!0}),t);var q={};R(q,{RecordMilestoneTool:()=>p,default:()=>M});module.exports=k(q);var m=require("zod");var g="The CRM didn't respond \u2014 please try again in a minute.",s=class extends Error{constructor(e,n){super(e),this.name="CrmError",this.detail=n}};function b(t){let{apiUrl:e,agentKey:n}=t,a=t.fetchFn??fetch;return{baseUrl:e.replace(/\/api\/graphql\/?$/,""),async query(i,y){let u;try{u=await a(e,{method:"POST",headers:{"content-type":"application/json","x-agent-key":n},body:JSON.stringify({query:i,variables:y})})}catch(o){throw new s(g,o instanceof Error?o.message:String(o))}if(!u.ok)throw new s(g,`HTTP ${u.status}`);let r;try{r=await u.json()}catch(o){throw new s(g,`invalid JSON response: ${o instanceof Error?o.message:String(o)}`)}if(r.errors?.length)throw new s(`The CRM rejected the request: ${r.errors.map(o=>o.message).join("; ")}`);if(r.data===void 0||r.data===null)throw new s(g,"empty data");return r.data}}}function f(){let t=env("CRM_API_URL"),e=env("CRM_AGENT_KEY");if(!t)throw new s("Agent misconfigured: CRM_API_URL is not set.");if(!e)throw new s("Agent misconfigured: CRM_AGENT_KEY is not set.");return b({apiUrl:t,agentKey:e})}var l="activities { type subject body occurredAt channel direction }",P={client:{rootField:"client",document:`
      query AgentClient($id: ID!) {
        client(id: $id) {
          id name sector status hqCity hqCountry website description
          revenueLastYear revenueForecast currency profitability existingInvestors staffCount
          createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          mandates { id name stage dealSize currency nextAction stageEnteredAt }
          transactions { id name stage targetRaise currency dealStatus stageEnteredAt }
          ${l}
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
          ${l}
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
          ${l}
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
          ${l}
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
          ${l}
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
    `}};var I=`
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
      ${l}
    }
  }
`;var S=`
  mutation TrackerRecordMilestone($input: MilestoneInput!) {
    recordMilestone(input: $input) { id key completedAt notes }
  }
`,h=`
  mutation TrackerUnrecordMilestone($engagementId: ID!, $key: MilestoneKey!) {
    unrecordMilestone(engagementId: $engagementId, key: $key)
  }
`;var T=`
  mutation TrackerLogActivity($input: LogActivityInput!) {
    logActivity(input: $input) { id }
  }
`;var x=new Set(["Excluded","Greylisted"]),N=new Set(["Declined"]),w=new Set(["FellOff","Dropped"]);function E(t,e){let n=t.engagementClassification;if(!n||!x.has(n))return{allowed:!0};if(e){let a=Object.keys(e).filter(i=>e[i]!==void 0);if(a.length>0&&a.every(i=>i==="engagementStage"&&N.has(String(e.engagementStage))||i==="disbursementStatus"&&w.has(String(e.disbursementStatus))))return{allowed:!0}}return{allowed:!1,message:`${t.name} is classified ${n} \u2014 this engagement cannot be advanced or updated. Only recording a decline or a fell-off/dropped disbursement is permitted. Ask an admin to review the investor's classification if this seems wrong.`}}var v=m.z.object({engagementId:m.z.string().min(1).describe("From a prior get_engagement_status or scan call"),action:m.z.enum(["record","unrecord"]).default("record").describe("record marks the milestone complete (upsert, safe to re-run); unrecord removes a mistaken entry"),key:m.z.enum(["TeaserReview","NdaExecuted","ExpressionOfInterest","DataRoomAccess","PreliminaryDD","ICPaperPrepared","FirstICApproval","NonBindingTermSheet","TermSheetExecuted","OnsiteDD","SecondICApproval","BindingOffer","DefinitiveAgreements","CompetitionApproval","SuccessFeePaid"]).describe("Which of the 15 investor-process milestones"),completedAt:m.z.string().optional().describe("ISO datetime the milestone was completed (defaults to now)"),notes:m.z.string().optional(),confirmed:m.z.literal(!0).describe("Only pass true after the user has explicitly confirmed this exact change in this conversation. If you have not asked yet, ask first \u2014 do not call this tool.")}),p=class{constructor(e){this.deps=e}deps;name="record_milestone";description="Record (or unrecord) one of the 15 investor-process milestones on an engagement \u2014 teaser review through NDA, IC approvals, term sheet, agreements, competition approval, success fee. REQUIRES prior user confirmation. Recording DataRoomAccess documents that a human already granted access \u2014 this agent never grants access itself.";inputSchema=v;async execute(e){let n=v.safeParse(e);if(!n.success)return{status:"rejected",message:`Invalid input: ${n.error.issues[0]?.message??"schema mismatch"}. Writes require confirmed: true after explicit user approval.`};let a=this.deps?.crm??f(),i=(await a.query(I,{id:e.engagementId})).engagement;if(!i)return{status:"not_found",message:"The engagement could not be loaded from the CRM."};let y=E(i.investor);if(!y.allowed)return{status:"refused",message:y.message};try{e.action==="unrecord"?await a.query(h,{engagementId:e.engagementId,key:e.key}):await a.query(S,{input:{engagementId:e.engagementId,key:e.key,completedAt:e.completedAt,notes:e.notes}})}catch(r){if(r instanceof s&&r.message!==g)return{status:"blocked",message:r.message};throw r}let u=!0;try{await a.query(T,{input:{type:"Note",subject:"Investor Tracker Agent milestone",body:`${e.action==="unrecord"?"Unrecorded":"Recorded"} milestone ${e.key}${e.notes?` \u2014 ${e.notes}`:""}`,engagementId:e.engagementId}})}catch{u=!1}return{status:"ok",action:e.action,key:e.key,auditLogged:u,link:`${a.baseUrl}/engagement/${e.engagementId}`}}};var d=new p,O={version:"2.0.0",kind:"tool",name:"record_milestone",description:"Record (or unrecord) one of the 15 investor-process milestones on an engagement \u2014 teaser review through NDA, IC approvals, term sheet, agreements, competition approval, success fee. REQUIRES prior user confirmation. Recording DataRoomAccess documents that a human already granted access \u2014 this agent never grants access itself.",exportName:"RecordMilestoneTool",pattern:"class-definition"},M={__lua_primitive__:O,primitive:{kind:"tool",name:d.name??"record_milestone",description:d.description??"Record (or unrecord) one of the 15 investor-process milestones on an engagement \u2014 teaser review through NDA, IC approvals, term sheet, agreements, competition approval, success fee. REQUIRES prior user confirmation. Recording DataRoomAccess documents that a human already granted access \u2014 this agent never grants access itself.",inputSchema:d.inputSchema,execute:typeof d.execute=="function"?d.execute.bind(d):void 0,condition:typeof d.condition=="function"?d.condition.bind(d):void 0}};0&&(module.exports={RecordMilestoneTool});
