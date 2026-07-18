var S=Object.defineProperty;var E=Object.getOwnPropertyDescriptor;var _=Object.getOwnPropertyNames;var x=Object.prototype.hasOwnProperty;var M=(a,e)=>{for(var n in e)S(a,n,{get:e[n],enumerable:!0})},N=(a,e,n,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let t of _(e))!x.call(a,t)&&t!==n&&S(a,t,{get:()=>e[t],enumerable:!(r=E(e,t))||r.enumerable});return a};var q=a=>N(S({},"__esModule",{value:!0}),a);var F={};M(F,{SummarizeRecordTool:()=>y,default:()=>j});module.exports=q(F);var p=require("zod");var f="The CRM didn't respond \u2014 please try again in a minute.",u=class extends Error{constructor(e,n){super(e),this.name="CrmError",this.detail=n}};function O(a){let{apiUrl:e,agentKey:n}=a,r=a.fetchFn??fetch;return{baseUrl:e.replace(/\/api\/graphql\/?$/,""),async query(i,o){let c;try{c=await r(e,{method:"POST",headers:{"content-type":"application/json","x-agent-key":n},body:JSON.stringify({query:i,variables:o})})}catch(d){throw new u(f,d instanceof Error?d.message:String(d))}if(!c.ok)throw new u(f,`HTTP ${c.status}`);let s;try{s=await c.json()}catch(d){throw new u(f,`invalid JSON response: ${d instanceof Error?d.message:String(d)}`)}if(s.errors?.length)throw new u(`The CRM rejected the request: ${s.errors.map(d=>d.message).join("; ")}`);if(s.data===void 0||s.data===null)throw new u(f,"empty data");return s.data}}}function D(){let a=env("CRM_API_URL"),e=env("CRM_AGENT_KEY");if(!a)throw new u("Agent misconfigured: CRM_API_URL is not set.");if(!e)throw new u("Agent misconfigured: CRM_AGENT_KEY is not set.");return O({apiUrl:a,agentKey:e})}var b=`
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`,m="activities { type subject body occurredAt channel direction }",I={client:{rootField:"client",document:`
      query AgentClient($id: ID!) {
        client(id: $id) {
          id name sector status hqCity hqCountry website description
          revenueLastYear revenueForecast currency profitability existingInvestors staffCount
          createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          mandates { id name stage dealSize currency nextAction stageEnteredAt }
          transactions { id name stage targetRaise currency dealStatus stageEnteredAt }
          ${m}
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
          ${m}
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
          ${m}
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
          ${m}
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
          ${m}
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
    `}};var $=`
  query AgentDocuments($clientId: ID, $investorId: ID, $mandateId: ID, $transactionId: ID) {
    documents(clientId: $clientId, investorId: $investorId, mandateId: $mandateId, transactionId: $transactionId) {
      name type status accessLevel uploadedAt isCurrent
    }
  }
`,R={client:"clientId",investor:"investorId",mandate:"mandateId",transaction:"transactionId"},B=`
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
      ${m}
    }
  }
`;var L={client:"Client",investor:"Investor",mandate:"Mandate",transaction:"Transaction",engagement:"Engagement",partner:"Partner"};function w(a,e,n){let r=L[e],t=a.filter(s=>s.type===r);if(t.length===0)return{kind:"none"};let i=t.find(s=>s.id===n);if(i)return{kind:"match",result:i};let o=n.trim().toLowerCase(),c=t.filter(s=>s.title.trim().toLowerCase()===o);return c.length===1?{kind:"match",result:c[0]}:t.length===1?{kind:"match",result:t[0]}:{kind:"ambiguous",candidates:t.slice(0,5)}}function C(a){let e={...a},n=e.activities;return Array.isArray(n)&&(e.activities=[...n].sort((r,t)=>String(t?.occurredAt??"").localeCompare(String(r?.occurredAt??""))).slice(0,20)),e}function k(a,e,n){let r=JSON.stringify(C(e),null,2);return[`You are an internal deal-ops analyst at NobleStride Capital. Write a concise briefing on the ${a} below.`,'Use EXACTLY these markdown sections, each as a "## " heading:',"Headline / Current status / Recent activity / Open items / Risks & stalls / Next steps.","Rules: use only facts present in the data \u2014 never invent numbers, names, or dates. Omit a bullet rather than guess.","Do not mention raw record IDs. Keep it under 250 words.",n?`The reader specifically asked about: ${n}. Weight the briefing toward that.`:"",`DATA:
${r}`].filter(Boolean).join(`

`)}function v(a,e){let n=C(e),r=[`## ${String(n.name??"(unnamed)")} \u2014 ${a} (raw facts; AI summary unavailable)`];for(let[t,i]of Object.entries(n))if(!(i==null||t==="id"||t.endsWith("Id")))if(Array.isArray(i))r.push(`- **${t}**: ${i.length} item(s)`);else if(typeof i=="object"){let o=i.name;o&&r.push(`- **${t}**: ${String(o)}`)}else r.push(`- **${t}**: ${String(i)}`);return r.join(`
`)}var P=p.z.object({recordType:p.z.enum(["client","investor","mandate","transaction","engagement","partner"]).describe("Which kind of CRM record to summarize"),query:p.z.string().min(1).describe("The record's name as the user said it, or an exact record id from a previous candidates list"),focus:p.z.string().optional().describe("Optional angle to weight the briefing toward, e.g. 'risks' or 'next steps'")}),y=class{constructor(e){this.deps=e}deps;name="summarize_record";description="Summarize one CRM record (client, investor, mandate, transaction, engagement, or partner) into a structured internal briefing with a deep link.";inputSchema=P;getDeps(){return this.deps??{crm:D(),generate:e=>AI.generate(e)}}async execute(e){let{crm:n,generate:r}=this.getDeps(),t=e.recordType,i=await n.query(b,{query:e.query,limit:10}),o=w(i.globalSearch,t,e.query);if(o.kind==="none")return{status:"not_found",message:`No ${t} matching "${e.query}" was found in the CRM.`};if(o.kind==="ambiguous")return{status:"ambiguous",message:`Multiple ${t}s match "${e.query}" \u2014 ask the user to pick one, then call this tool again with the chosen id as query.`,candidates:o.candidates.map(g=>({id:g.id,title:g.title,subtitle:g.subtitle??null}))};let{document:c,rootField:s}=I[t],h=(await n.query(c,{id:o.result.id}))[s];if(!h)return{status:"not_found",message:`The ${t} could not be loaded from the CRM.`};let T=R[t];if(T)try{let g=await n.query($,{[T]:o.result.id});h.documents=(g.documents??[]).slice(0,10)}catch{}let A;try{A=await r(k(t,h,e.focus))}catch{A=v(t,h)}return{status:"ok",summary:A,link:`${n.baseUrl}${o.result.href}`}}};var l=new y,U={version:"2.0.0",kind:"tool",name:"summarize_record",description:"Summarize one CRM record (client, investor, mandate, transaction, engagement, or partner) into a structured internal briefing with a deep link.",exportName:"SummarizeRecordTool",pattern:"class-definition"},j={__lua_primitive__:U,primitive:{kind:"tool",name:l.name??"summarize_record",description:l.description??"Summarize one CRM record (client, investor, mandate, transaction, engagement, or partner) into a structured internal briefing with a deep link.",inputSchema:l.inputSchema,execute:typeof l.execute=="function"?l.execute.bind(l):void 0,condition:typeof l.condition=="function"?l.condition.bind(l):void 0}};0&&(module.exports={SummarizeRecordTool});
