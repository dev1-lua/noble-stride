var S=Object.defineProperty;var k=Object.getOwnPropertyDescriptor;var N=Object.getOwnPropertyNames;var M=Object.prototype.hasOwnProperty;var F=(r,e)=>{for(var n in e)S(r,n,{get:e[n],enumerable:!0})},P=(r,e,n,a)=>{if(e&&typeof e=="object"||typeof e=="function")for(let t of N(e))!M.call(r,t)&&t!==n&&S(r,t,{get:()=>e[t],enumerable:!(a=k(e,t))||a.enumerable});return r};var q=r=>P(S({},"__esModule",{value:!0}),r);var Y={};F(Y,{SummarizeRecordTool:()=>f,default:()=>B});module.exports=q(Y);var y=require("zod");var R="The CRM didn't respond \u2014 please try again in a minute.",u=class extends Error{constructor(e,n){super(e),this.name="CrmError",this.detail=n}};function U(r){let{apiUrl:e,agentKey:n}=r,a=r.fetchFn??fetch;return{baseUrl:e.replace(/\/api\/graphql\/?$/,""),async query(i,o){let c;try{c=await a(e,{method:"POST",headers:{"content-type":"application/json","x-agent-key":n},body:JSON.stringify({query:i,variables:o})})}catch(d){throw new u(R,d instanceof Error?d.message:String(d))}if(!c.ok)throw new u(R,`HTTP ${c.status}`);let s;try{s=await c.json()}catch(d){throw new u(R,`invalid JSON response: ${d instanceof Error?d.message:String(d)}`)}if(s.errors?.length)throw new u(`The CRM rejected the request: ${s.errors.map(d=>d.message).join("; ")}`);if(s.data===void 0||s.data===null)throw new u(R,"empty data");return s.data}}}function I(){let r=env("CRM_API_URL"),e=env("CRM_AGENT_KEY");if(!r)throw new u("Agent misconfigured: CRM_API_URL is not set.");if(!e)throw new u("Agent misconfigured: CRM_AGENT_KEY is not set.");return U({apiUrl:r,agentKey:e})}var C=`
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`,g="activities { type subject body occurredAt channel direction }",h="stageChanges { field fromValue toValue changedAt createdSource changedBy { name } }",m="feeSharingAgreement feeSharingTerms partnerAgreementStatus internalOnly",E={client:{rootField:"client",document:`
      query AgentClient($id: ID!) {
        client(id: $id) {
          id name sector status hqCity hqCountry website description
          revenueLastYear revenueForecast currency profitability existingInvestors staffCount
          createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          mandates { id name stage dealSize currency nextAction stageEnteredAt }
          transactions { id name stage targetRaise currency dealStatus stageEnteredAt }
          ${g}
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
          ${g}
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
          ${g}
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
          ${g}
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
          ${g}
        }
      }
    `},partner:{rootField:"partner",document:`
      query AgentPartner($id: ID!) {
        partner(id: $id) {
          id name partnerType status location organization email phone profile
          ${m} feedbackNotes
          createdAt updatedAt
          contacts { firstName lastName email }
          referredMandates { id name stage }
          referredTransactions { id name stage }
        }
      }
    `}},_=`
  query AgentDocuments($clientId: ID, $investorId: ID, $mandateId: ID, $transactionId: ID) {
    documents(clientId: $clientId, investorId: $investorId, mandateId: $mandateId, transactionId: $transactionId) {
      name type status accessLevel uploadedAt isCurrent
    }
  }
`,D={client:"clientId",investor:"investorId",mandate:"mandateId",transaction:"transactionId"};var K=`
  query ReferralPartnerDetail($id: ID!) {
    partner(id: $id) {
      id name partnerType status location organization email phone profile
      ${m} feedbackNotes
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
      ${h}
    }
  }
`,H=`
  query ReferralMandateStatus($id: ID!) {
    mandate(id: $id) {
      id name stage stageEnteredAt daysInStage dealStatus dealSize currency
      dateOpened createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${m} }
      transactions { id name stage dealStatus targetRaise currency partnerFeeStatus partnerFeeAmount }
      ${h}
    }
  }
`,W=`
  query ReferralTransactionStatus($id: ID!) {
    transaction(id: $id) {
      id name stage stageEnteredAt dealStatus targetRaise currency
      partnerFeeStatus partnerFeeAmount
      dateOpened closedAt createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${m} }
      mandate {
        id name stage
        referredBy { id name partnerType status ${m} }
      }
      ${h}
    }
  }
`;var Q=`
  mutation ReferralCreatePartner($input: PartnerInput!) {
    createPartner(input: $input) {
      id name partnerType status organization email phone
      ${m} updatedAt
    }
  }
`,V=`
  mutation ReferralUpdatePartner($id: ID!, $input: PartnerInput!) {
    updatePartner(id: $id, input: $input) {
      id name partnerType status organization email phone
      ${m} feedbackNotes updatedAt
    }
  }
`;var L={client:"Client",investor:"Investor",mandate:"Mandate",transaction:"Transaction",engagement:"Engagement",partner:"Partner"};function b(r,e,n){let a=L[e],t=r.filter(s=>s.type===a);if(t.length===0)return{kind:"none"};let i=t.find(s=>s.id===n);if(i)return{kind:"match",result:i};let o=n.trim().toLowerCase(),c=t.filter(s=>s.title.trim().toLowerCase()===o);return c.length===1?{kind:"match",result:c[0]}:t.length===1?{kind:"match",result:t[0]}:{kind:"ambiguous",candidates:t.slice(0,5)}}function v(r){let e={...r},n=e.activities;return Array.isArray(n)&&(e.activities=[...n].sort((a,t)=>String(t?.occurredAt??"").localeCompare(String(a?.occurredAt??""))).slice(0,20)),e}function w(r,e,n){let a=JSON.stringify(v(e),null,2);return[`You are an internal deal-ops analyst at NobleStride Capital. Write a concise briefing on the ${r} below.`,'Use EXACTLY these markdown sections, each as a "## " heading:',"Headline / Current status / Recent activity / Open items / Risks & stalls / Next steps.","Rules: use only facts present in the data \u2014 never invent numbers, names, or dates. Omit a bullet rather than guess.","Do not mention raw record IDs. Keep it under 250 words.",n?`The reader specifically asked about: ${n}. Weight the briefing toward that.`:"",`DATA:
${a}`].filter(Boolean).join(`

`)}function x(r,e){let n=v(e),a=[`## ${String(n.name??"(unnamed)")} \u2014 ${r} (raw facts; AI summary unavailable)`];for(let[t,i]of Object.entries(n))if(!(i==null||t==="id"||t.endsWith("Id")))if(Array.isArray(i))a.push(`- **${t}**: ${i.length} item(s)`);else if(typeof i=="object"){let o=i.name;o&&a.push(`- **${t}**: ${String(o)}`)}else a.push(`- **${t}**: ${String(i)}`);return a.join(`
`)}var O=y.z.object({recordType:y.z.enum(["client","investor","mandate","transaction","engagement","partner"]).describe("Which kind of CRM record to summarize"),query:y.z.string().min(1).describe("The record's name as the user said it, or an exact record id from a previous candidates list"),focus:y.z.string().optional().describe("Optional angle to weight the briefing toward, e.g. 'risks' or 'next steps'")}),f=class{constructor(e){this.deps=e}deps;name="summarize_record";description="Summarize one CRM record (client, investor, mandate, transaction, engagement, or partner) into a structured internal briefing with a deep link.";inputSchema=O;getDeps(){return this.deps??{crm:I(),generate:e=>AI.generate(e)}}async execute(e){let{crm:n,generate:a}=this.getDeps(),t=e.recordType,i=await n.query(C,{query:e.query,limit:10}),o=b(i.globalSearch,t,e.query);if(o.kind==="none")return{status:"not_found",message:`No ${t} matching "${e.query}" was found in the CRM.`};if(o.kind==="ambiguous")return{status:"ambiguous",message:`Multiple ${t}s match "${e.query}" \u2014 ask the user to pick one, then call this tool again with the chosen id as query.`,candidates:o.candidates.map(p=>({id:p.id,title:p.title,subtitle:p.subtitle??null}))};let{document:c,rootField:s}=E[t],A=(await n.query(c,{id:o.result.id}))[s];if(!A)return{status:"not_found",message:`The ${t} could not be loaded from the CRM.`};let $=D[t];if($)try{let p=await n.query(_,{[$]:o.result.id});A.documents=(p.documents??[]).slice(0,10)}catch{}let T;try{T=await a(w(t,A,e.focus))}catch{T=x(t,A)}return{status:"ok",summary:T,link:`${n.baseUrl}${o.result.href}`}}};var l=new f,z={version:"2.0.0",kind:"tool",name:"summarize_record",description:"Summarize one CRM record (client, investor, mandate, transaction, engagement, or partner) into a structured internal briefing with a deep link.",exportName:"SummarizeRecordTool",pattern:"class-definition"},B={__lua_primitive__:z,primitive:{kind:"tool",name:l.name??"summarize_record",description:l.description??"Summarize one CRM record (client, investor, mandate, transaction, engagement, or partner) into a structured internal briefing with a deep link.",inputSchema:l.inputSchema,execute:typeof l.execute=="function"?l.execute.bind(l):void 0,condition:typeof l.condition=="function"?l.condition.bind(l):void 0}};0&&(module.exports={SummarizeRecordTool});
