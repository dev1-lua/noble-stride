var h=Object.defineProperty;var w=Object.getOwnPropertyDescriptor;var N=Object.getOwnPropertyNames;var P=Object.prototype.hasOwnProperty;var M=(t,e)=>{for(var a in e)h(t,a,{get:e[a],enumerable:!0})},O=(t,e,a,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of N(e))!P.call(t,n)&&n!==a&&h(t,n,{get:()=>e[n],enumerable:!(i=w(e,n))||i.enumerable});return t};var L=t=>O(h({},"__esModule",{value:!0}),t);var j={};M(j,{CreateFollowupTaskTool:()=>f,default:()=>Y});module.exports=L(j);var m=require("zod");var y="The CRM didn't respond \u2014 please try again in a minute.",u=class extends Error{constructor(e,a){super(e),this.name="CrmError",this.detail=a}};function q(t){let{apiUrl:e,agentKey:a}=t,i=t.fetchFn??fetch;return{baseUrl:e.replace(/\/api\/graphql\/?$/,""),async query(d,l){let r;try{r=await i(e,{method:"POST",headers:{"content-type":"application/json","x-agent-key":a},body:JSON.stringify({query:d,variables:l})})}catch(c){throw new u(y,c instanceof Error?c.message:String(c))}if(!r.ok)throw new u(y,`HTTP ${r.status}`);let s;try{s=await r.json()}catch(c){throw new u(y,`invalid JSON response: ${c instanceof Error?c.message:String(c)}`)}if(s.errors?.length)throw new u(`The CRM rejected the request: ${s.errors.map(c=>c.message).join("; ")}`);if(s.data===void 0||s.data===null)throw new u(y,"empty data");return s.data}}}function k(){let t=env("CRM_API_URL"),e=env("CRM_AGENT_KEY");if(!t)throw new u("Agent misconfigured: CRM_API_URL is not set.");if(!e)throw new u("Agent misconfigured: CRM_AGENT_KEY is not set.");return q({apiUrl:t,agentKey:e})}var v=`
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`,p="activities { type subject body occurredAt channel direction }",S={client:{rootField:"client",document:`
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
    `}};var _=`
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
`;var R=`
  query TrackerTransactionById($id: ID!) {
    transaction(id: $id) { id name }
  }
`,E=`
  query TrackerInvestorById($id: ID!) {
    investor(id: $id) { id name }
  }
`;var C=`
  mutation TrackerCreateTask($input: TaskInput!) {
    createTask(input: $input) { id title status dueAt }
  }
`;var I={client:"Client",investor:"Investor",mandate:"Mandate",transaction:"Transaction",engagement:"Engagement",partner:"Partner"};function b(t,e,a){let i=I[e],n=t.filter(s=>s.type===i);if(n.length===0)return{kind:"none"};let d=n.find(s=>s.id===a);if(d)return{kind:"match",result:d};let l=a.trim().toLowerCase(),r=n.filter(s=>s.title.trim().toLowerCase()===l);return r.length===1?{kind:"match",result:r[0]}:n.length===1?{kind:"match",result:n[0]}:{kind:"ambiguous",candidates:n.slice(0,5)}}var U={transaction:{document:R,rootField:"transaction",hrefPrefix:"/transactions"},investor:{document:E,rootField:"investor",hrefPrefix:"/investors"}};function F(t){return/^c[a-z0-9]{20,32}$/i.test(t.trim())}async function A(t,e,a){let i=await t.query(v,{query:a,limit:10}),n=b(i.globalSearch,e,a);if(n.kind!=="none"||!F(a))return n;let d=U[e];if(!d)return n;try{let r=(await t.query(d.document,{id:a.trim()}))[d.rootField];if(r)return{kind:"match",result:{id:r.id,type:I[e],title:r.name,subtitle:null,href:`${d.hrefPrefix}/${r.id}`}}}catch{}return n}async function D(t,e,a){let[i,n]=await Promise.all([A(t,"investor",e),A(t,"transaction",a)]);if(i.kind==="none")return{kind:"investor_not_found"};if(i.kind==="ambiguous")return{kind:"ambiguous_investor",candidates:$(i.candidates)};if(n.kind==="none")return{kind:"deal_not_found"};if(n.kind==="ambiguous")return{kind:"ambiguous_deal",candidates:$(n.candidates)};let l=(await t.query(S.transaction.document,{id:n.result.id})).transaction;if(!l)return{kind:"deal_not_found"};let r={id:i.result.id,name:i.result.title},s={id:l.id,name:l.name},c=l.engagements.find(T=>T.investor.id===r.id);return c?{kind:"ok",engagementId:c.id,investor:r,transaction:s}:{kind:"no_engagement",investor:r,transaction:s}}function $(t){return t.map(e=>({id:e.id,title:e.title,subtitle:e.subtitle??null}))}var B="Created by Investor Tracker Agent";function G(t,e){let a=new Date(t),i=e;for(;i>0;){a.setDate(a.getDate()+1);let n=a.getDay();n!==0&&n!==6&&(i-=1)}return a}var x=m.z.object({title:m.z.string().min(1).describe("Short imperative task title, e.g. 'Follow up with Vantage on the term sheet'"),body:m.z.string().optional().describe("Context for whoever picks the task up"),dueAt:m.z.string().optional().describe("ISO datetime the task is due \u2014 defaults to 3 business days from now"),engagementId:m.z.string().optional().describe("Preferred \u2014 links the task to both the deal and the investor automatically"),investor:m.z.string().optional().describe("Investor name/id, used with deal when engagementId is unknown"),deal:m.z.string().optional().describe("Deal name/id, used with investor when engagementId is unknown"),confirmed:m.z.literal(!0).describe("Only pass true after the user has explicitly confirmed this exact task in this conversation. If you have not asked yet, ask first \u2014 do not call this tool.")}),f=class{constructor(e){this.deps=e}deps;name="create_followup_task";description="Create a follow-up Task for the deal lead, linked to the relevant deal and investor. REQUIRES prior user confirmation. The deal lead acts on it \u2014 this agent never contacts anyone itself.";inputSchema=x;async execute(e){let a=x.safeParse(e);if(!a.success)return{status:"rejected",message:`Invalid input: ${a.error.issues[0]?.message??"schema mismatch"}. Writes require confirmed: true after explicit user approval.`};let i=this.deps?.crm??k(),n=this.deps?.now?this.deps.now():new Date,d,l,r;if(e.engagementId){let o=await i.query(_,{id:e.engagementId});if(!o.engagement)return{status:"not_found",message:"The engagement could not be loaded from the CRM."};d=o.engagement.transactionId,l=o.engagement.investorId,r=`${i.baseUrl}/engagement/${o.engagement.id}`}else if(e.investor&&e.deal){let o=await D(i,e.investor,e.deal);if(o.kind==="ambiguous_investor"||o.kind==="ambiguous_deal")return{status:o.kind,message:"Multiple records match \u2014 ask the user to pick one, then call again with the chosen id.",candidates:o.candidates};if(o.kind==="investor_not_found"||o.kind==="deal_not_found")return{status:o.kind,message:"No matching record was found in the CRM."};o.kind==="ok"&&(r=`${i.baseUrl}/engagement/${o.engagementId}`),d=o.transaction.id,l=o.investor.id}let s=e.dueAt??G(n,3).toISOString(),c=[e.body,r,`${B}.`].filter(Boolean);return{status:"ok",task:(await i.query(C,{input:{title:e.title,body:c.join(`
`),status:"NotStarted",source:"Other",dueAt:s,transactionId:d,investorId:l}})).createTask,link:r??null}}};var g=new f,K={version:"2.0.0",kind:"tool",name:"create_followup_task",description:"Create a follow-up Task for the deal lead, linked to the relevant deal and investor. REQUIRES prior user confirmation. The deal lead acts on it \u2014 this agent never contacts anyone itself.",exportName:"CreateFollowupTaskTool",pattern:"class-definition"},Y={__lua_primitive__:K,primitive:{kind:"tool",name:g.name??"create_followup_task",description:g.description??"Create a follow-up Task for the deal lead, linked to the relevant deal and investor. REQUIRES prior user confirmation. The deal lead acts on it \u2014 this agent never contacts anyone itself.",inputSchema:g.inputSchema,execute:typeof g.execute=="function"?g.execute.bind(g):void 0,condition:typeof g.condition=="function"?g.condition.bind(g):void 0}};0&&(module.exports={CreateFollowupTaskTool});
