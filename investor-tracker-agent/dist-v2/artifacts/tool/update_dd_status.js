var A=Object.defineProperty;var $=Object.getOwnPropertyDescriptor;var v=Object.getOwnPropertyNames;var b=Object.prototype.hasOwnProperty;var x=(n,e)=>{for(var r in e)A(n,r,{get:e[r],enumerable:!0})},N=(n,e,r,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let t of v(e))!b.call(n,t)&&t!==r&&A(n,t,{get:()=>e[t],enumerable:!(i=$(e,t))||i.enumerable});return n};var w=n=>N(A({},"__esModule",{value:!0}),n);var U={};x(U,{UpdateDDStatusTool:()=>y,default:()=>q});module.exports=w(U);var l=require("zod");var g="The CRM didn't respond \u2014 please try again in a minute.",d=class extends Error{constructor(e,r){super(e),this.name="CrmError",this.detail=r}};function L(n){let{apiUrl:e,agentKey:r}=n,i=n.fetchFn??fetch;return{baseUrl:e.replace(/\/api\/graphql\/?$/,""),async query(o,m){let s;try{s=await i(e,{method:"POST",headers:{"content-type":"application/json","x-agent-key":r},body:JSON.stringify({query:o,variables:m})})}catch(c){throw new d(g,c instanceof Error?c.message:String(c))}if(!s.ok)throw new d(g,`HTTP ${s.status}`);let a;try{a=await s.json()}catch(c){throw new d(g,`invalid JSON response: ${c instanceof Error?c.message:String(c)}`)}if(a.errors?.length)throw new d(`The CRM rejected the request: ${a.errors.map(c=>c.message).join("; ")}`);if(a.data===void 0||a.data===null)throw new d(g,"empty data");return a.data}}}function f(){let n=env("CRM_API_URL"),e=env("CRM_AGENT_KEY");if(!n)throw new d("Agent misconfigured: CRM_API_URL is not set.");if(!e)throw new d("Agent misconfigured: CRM_AGENT_KEY is not set.");return L({apiUrl:n,agentKey:e})}var h=`
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`,p="activities { type subject body occurredAt channel direction }",B={client:{rootField:"client",document:`
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
    `}};var Y=`
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
`;var S=`
  query TrackerTransactionById($id: ID!) {
    transaction(id: $id) { id name }
  }
`,I=`
  query TrackerInvestorById($id: ID!) {
    investor(id: $id) { id name }
  }
`,k=`
  query TrackerDdTracks($id: ID!) {
    transaction(id: $id) {
      id
      ddTracks { track status notes startedAt completedAt }
    }
  }
`;var _=`
  mutation TrackerUpsertDdTrack($input: DueDiligenceTrackInput!) {
    upsertDueDiligenceTrack(input: $input) { id track status notes startedAt completedAt }
  }
`;var R=`
  mutation TrackerLogActivity($input: LogActivityInput!) {
    logActivity(input: $input) { id }
  }
`;var T={client:"Client",investor:"Investor",mandate:"Mandate",transaction:"Transaction",engagement:"Engagement",partner:"Partner"};function D(n,e,r){let i=T[e],t=n.filter(a=>a.type===i);if(t.length===0)return{kind:"none"};let o=t.find(a=>a.id===r);if(o)return{kind:"match",result:o};let m=r.trim().toLowerCase(),s=t.filter(a=>a.title.trim().toLowerCase()===m);return s.length===1?{kind:"match",result:s[0]}:t.length===1?{kind:"match",result:t[0]}:{kind:"ambiguous",candidates:t.slice(0,5)}}var O={transaction:{document:S,rootField:"transaction",hrefPrefix:"/transactions"},investor:{document:I,rootField:"investor",hrefPrefix:"/investors"}};function M(n){return/^c[a-z0-9]{20,32}$/i.test(n.trim())}async function E(n,e,r){let i=await n.query(h,{query:r,limit:10}),t=D(i.globalSearch,e,r);if(t.kind!=="none"||!M(r))return t;let o=O[e];if(!o)return t;try{let s=(await n.query(o.document,{id:r.trim()}))[o.rootField];if(s)return{kind:"match",result:{id:s.id,type:T[e],title:s.name,subtitle:null,href:`${o.hrefPrefix}/${s.id}`}}}catch{}return t}var C=l.z.object({deal:l.z.string().min(1).describe("The transaction/deal whose due diligence to update \u2014 name or exact id"),track:l.z.enum(["Financial","Tax","Commercial","ESG","Legal"]).describe("Which DD workstream"),status:l.z.enum(["NotStarted","InProgress","Complete","Flagged","NotApplicable"]),notes:l.z.string().optional(),startedAt:l.z.string().optional().describe("ISO datetime the workstream started"),completedAt:l.z.string().optional().describe("ISO datetime the workstream completed"),confirmed:l.z.literal(!0).describe("Only pass true after the user has explicitly confirmed this exact change in this conversation. If you have not asked yet, ask first \u2014 do not call this tool.")}),y=class{constructor(e){this.deps=e}deps;name="update_dd_status";description="Update the status of one due-diligence workstream (Financial, Tax, Commercial, ESG, Legal) on a deal, then return all five tracks. REQUIRES prior user confirmation. DD tracks are internal-only records.";inputSchema=C;async execute(e){let r=C.safeParse(e);if(!r.success)return{status:"rejected",message:`Invalid input: ${r.error.issues[0]?.message??"schema mismatch"}. Writes require confirmed: true after explicit user approval.`};let i=this.deps?.crm??f(),t=await E(i,"transaction",e.deal);if(t.kind==="none")return{status:"not_found",message:`No deal matching "${e.deal}" was found in the CRM.`};if(t.kind==="ambiguous")return{status:"ambiguous",message:"Multiple deals match \u2014 ask the user to pick one, then call again with the chosen id.",candidates:t.candidates.map(a=>({id:a.id,title:a.title,subtitle:a.subtitle??null}))};let o=t.result.id;try{await i.query(_,{input:{transactionId:o,track:e.track,status:e.status,notes:e.notes,startedAt:e.startedAt,completedAt:e.completedAt}})}catch(a){if(a instanceof d&&a.message!==g)return{status:"blocked",message:a.message};throw a}let m=!0;try{await i.query(R,{input:{type:"Note",subject:"Investor Tracker Agent DD update",body:`${e.track} due diligence \u2192 ${e.status}${e.notes?` \u2014 ${e.notes}`:""}`,transactionId:o}})}catch{m=!1}let s=await i.query(k,{id:o});return{status:"ok",deal:t.result.title,ddTracks:s.transaction?.ddTracks??[],auditLogged:m,link:`${i.baseUrl}${t.result.href}`}}};var u=new y,P={version:"2.0.0",kind:"tool",name:"update_dd_status",description:"Update the status of one due-diligence workstream (Financial, Tax, Commercial, ESG, Legal) on a deal, then return all five tracks. REQUIRES prior user confirmation. DD tracks are internal-only records.",exportName:"UpdateDDStatusTool",pattern:"class-definition"},q={__lua_primitive__:P,primitive:{kind:"tool",name:u.name??"update_dd_status",description:u.description??"Update the status of one due-diligence workstream (Financial, Tax, Commercial, ESG, Legal) on a deal, then return all five tracks. REQUIRES prior user confirmation. DD tracks are internal-only records.",inputSchema:u.inputSchema,execute:typeof u.execute=="function"?u.execute.bind(u):void 0,condition:typeof u.condition=="function"?u.condition.bind(u):void 0}};0&&(module.exports={UpdateDDStatusTool});
