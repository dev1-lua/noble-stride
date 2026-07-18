var A=Object.defineProperty;var $=Object.getOwnPropertyDescriptor;var C=Object.getOwnPropertyNames;var v=Object.prototype.hasOwnProperty;var E=(e,t)=>{for(var n in t)A(e,n,{get:t[n],enumerable:!0})},_=(e,t,n,s)=>{if(t&&typeof t=="object"||typeof t=="function")for(let i of C(t))!v.call(e,i)&&i!==n&&A(e,i,{get:()=>t[i],enumerable:!(s=$(t,i))||s.enumerable});return e};var k=e=>_(A({},"__esModule",{value:!0}),e);var P={};E(P,{PipelineDigestTool:()=>g,default:()=>M});module.exports=k(P);var y=require("zod");var p="The CRM didn't respond \u2014 please try again in a minute.",c=class extends Error{constructor(t,n){super(t),this.name="CrmError",this.detail=n}};function R(e){let{apiUrl:t,agentKey:n}=e,s=e.fetchFn??fetch;return{baseUrl:t.replace(/\/api\/graphql\/?$/,""),async query(a,o){let l;try{l=await s(t,{method:"POST",headers:{"content-type":"application/json","x-agent-key":n},body:JSON.stringify({query:a,variables:o})})}catch(r){throw new c(p,r instanceof Error?r.message:String(r))}if(!l.ok)throw new c(p,`HTTP ${l.status}`);let d;try{d=await l.json()}catch(r){throw new c(p,`invalid JSON response: ${r instanceof Error?r.message:String(r)}`)}if(d.errors?.length)throw new c(`The CRM rejected the request: ${d.errors.map(r=>r.message).join("; ")}`);if(d.data===void 0||d.data===null)throw new c(p,"empty data");return d.data}}}function D(){let e=env("CRM_API_URL"),t=env("CRM_AGENT_KEY");if(!e)throw new c("Agent misconfigured: CRM_API_URL is not set.");if(!t)throw new c("Agent misconfigured: CRM_AGENT_KEY is not set.");return R({apiUrl:e,agentKey:t})}var u="activities { type subject body occurredAt channel direction }",L={client:{rootField:"client",document:`
      query AgentClient($id: ID!) {
        client(id: $id) {
          id name sector status hqCity hqCountry website description
          revenueLastYear revenueForecast currency profitability existingInvestors staffCount
          createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          mandates { id name stage dealSize currency nextAction stageEnteredAt }
          transactions { id name stage targetRaise currency dealStatus stageEnteredAt }
          ${u}
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
          ${u}
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
          ${u}
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
          ${u}
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
          ${u}
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
    `}},h=`
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
`;var U=`
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
      ${u}
    }
  }
`;function S(e,t,n){let s=n.getTime()-t*864e5,i={moved:[],newEntries:[],stalled:[],totalsByStage:[]};for(let a of e){i.totalsByStage.push({label:a.label,count:a.items.length});for(let o of a.items){let l=Math.min(new Date(o.createdAt).getTime(),o.dateOpened?new Date(o.dateOpened).getTime():1/0),d=o.stageEnteredAt?new Date(o.stageEnteredAt).getTime():null,r=new Date(o.updatedAt).getTime();l>=s?i.newEntries.push({name:o.name,stage:a.label}):d!==null&&d>=s?i.moved.push({name:o.name,stage:a.label}):r<s&&i.stalled.push({name:o.name,stage:a.label,idleDays:Math.floor((n.getTime()-r)/864e5)})}}return i}function f(e){return{windowDays:e.windowDays,generatedAt:e.now.toISOString(),mandates:S(e.mandateColumns,e.windowDays,e.now),transactions:S(e.transactionColumns,e.windowDays,e.now)}}function T(e,t){let n=[];return t!=="transactions"&&n.push(["Mandates (client acquisition)",e.mandates]),t!=="mandates"&&n.push(["Transactions (fundraising execution)",e.transactions]),n}function w(e,t){let n=JSON.stringify(Object.fromEntries(T(e,t)),null,2);return[`You are an internal deal-ops analyst at NobleStride Capital. Write the pipeline digest for the last ${e.windowDays} days.`,'Use EXACTLY these markdown sections, each as a "## " heading: Movement / New entries / Stalled deals / Totals by stage.','Rules: use only facts in the data \u2014 never invent. If a section is empty, write "Nothing this period." Keep it under 300 words.',`DATA:
${n}`].join(`

`)}function I(e,t){let n=[`# Pipeline digest \u2014 last ${e.windowDays} days (raw facts; AI summary unavailable)`];for(let[s,i]of T(e,t))n.push(`
## ${s}`),n.push(`**Movement:** ${i.moved.map(a=>`${a.name} \u2192 ${a.stage}`).join("; ")||"Nothing this period."}`),n.push(`**New entries:** ${i.newEntries.map(a=>`${a.name} (${a.stage})`).join("; ")||"Nothing this period."}`),n.push(`**Stalled:** ${i.stalled.map(a=>`${a.name} (${a.stage}, ${a.idleDays}d idle)`).join("; ")||"Nothing this period."}`),n.push(`**Totals:** ${i.totalsByStage.map(a=>`${a.label}: ${a.count}`).join(", ")}`);return n.join(`
`)}async function b(e,t,n){let s=e.now?e.now():new Date,i=await e.crm.query(h),a=f({mandateColumns:i.mandatesByStage,transactionColumns:i.transactionsByStage,windowDays:t,now:s});try{return await e.generate(w(a,n))}catch{return I(a,n)}}var x=y.z.object({days:y.z.number().int().min(1).max(90).default(7).describe("Lookback window in days"),pipeline:y.z.enum(["mandates","transactions","both"]).default("both")}),g=class{constructor(t){this.deps=t}deps;name="pipeline_digest";description="Pipeline movement digest: what moved stage, what's new, what's stalled, and totals by stage \u2014 for mandates, transactions, or both.";inputSchema=x;getDeps(){return this.deps??{crm:D(),generate:t=>AI.generate(t)}}async execute(t){return{status:"ok",digest:await b(this.getDeps(),t.days,t.pipeline)}}};var m=new g,N={version:"2.0.0",kind:"tool",name:"pipeline_digest",description:"Pipeline movement digest: what moved stage, what's new, what's stalled, and totals by stage \u2014 for mandates, transactions, or both.",exportName:"PipelineDigestTool",pattern:"class-definition"},M={__lua_primitive__:N,primitive:{kind:"tool",name:m.name??"pipeline_digest",description:m.description??"Pipeline movement digest: what moved stage, what's new, what's stalled, and totals by stage \u2014 for mandates, transactions, or both.",inputSchema:m.inputSchema,execute:typeof m.execute=="function"?m.execute.bind(m):void 0,condition:typeof m.condition=="function"?m.condition.bind(m):void 0}};0&&(module.exports={PipelineDigestTool});
