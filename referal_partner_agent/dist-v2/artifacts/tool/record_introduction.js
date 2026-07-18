var S=Object.defineProperty;var U=Object.getOwnPropertyDescriptor;var L=Object.getOwnPropertyNames;var q=Object.prototype.hasOwnProperty;var B=(t,e)=>{for(var n in e)S(t,n,{get:e[n],enumerable:!0})},j=(t,e,n,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let s of L(e))!q.call(t,s)&&s!==n&&S(t,s,{get:()=>e[s],enumerable:!(i=U(e,s))||i.enumerable});return t};var Y=t=>j(S({},"__esModule",{value:!0}),t);var Q={};B(Q,{RecordIntroductionTool:()=>R,default:()=>W});module.exports=Y(Q);var a=require("zod");var f="The CRM didn't respond \u2014 please try again in a minute.",m=class extends Error{constructor(e,n){super(e),this.name="CrmError",this.detail=n}};function G(t){let{apiUrl:e,agentKey:n}=t,i=t.fetchFn??fetch;return{baseUrl:e.replace(/\/api\/graphql\/?$/,""),async query(y,p){let d;try{d=await i(e,{method:"POST",headers:{"content-type":"application/json","x-agent-key":n},body:JSON.stringify({query:y,variables:p})})}catch(c){throw new m(f,c instanceof Error?c.message:String(c))}if(!d.ok)throw new m(f,`HTTP ${d.status}`);let r;try{r=await d.json()}catch(c){throw new m(f,`invalid JSON response: ${c instanceof Error?c.message:String(c)}`)}if(r.errors?.length)throw new m(`The CRM rejected the request: ${r.errors.map(c=>c.message).join("; ")}`);if(r.data===void 0||r.data===null)throw new m(f,"empty data");return r.data}}}function x(){let t=env("CRM_API_URL"),e=env("CRM_AGENT_KEY");if(!t)throw new m("Agent misconfigured: CRM_API_URL is not set.");if(!e)throw new m("Agent misconfigured: CRM_AGENT_KEY is not set.");return G({apiUrl:t,agentKey:e})}var _=`
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`,A="activities { type subject body occurredAt channel direction }",w="stageChanges { field fromValue toValue changedAt createdSource changedBy { name } }",h="feeSharingAgreement feeSharingTerms partnerAgreementStatus internalOnly",X={client:{rootField:"client",document:`
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
          ${h} feedbackNotes
          createdAt updatedAt
          contacts { firstName lastName email }
          referredMandates { id name stage }
          referredTransactions { id name stage }
        }
      }
    `}};var b=`
  query ReferralPartnerById($id: ID!) {
    partner(id: $id) { id name }
  }
`;var Z=`
  query ReferralPartnerDetail($id: ID!) {
    partner(id: $id) {
      id name partnerType status location organization email phone profile
      ${h} feedbackNotes
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
      ${w}
    }
  }
`,ee=`
  query ReferralMandateStatus($id: ID!) {
    mandate(id: $id) {
      id name stage stageEnteredAt daysInStage dealStatus dealSize currency
      dateOpened createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${h} }
      transactions { id name stage dealStatus targetRaise currency partnerFeeStatus partnerFeeAmount }
      ${w}
    }
  }
`,te=`
  query ReferralTransactionStatus($id: ID!) {
    transaction(id: $id) {
      id name stage stageEnteredAt dealStatus targetRaise currency
      partnerFeeStatus partnerFeeAmount
      dateOpened closedAt createdAt updatedAt clientId
      client { id name }
      referredBy { id name partnerType status ${h} }
      mandate {
        id name stage
        referredBy { id name partnerType status ${h} }
      }
      ${w}
    }
  }
`;var D=`
  mutation ReferralCreatePartner($input: PartnerInput!) {
    createPartner(input: $input) {
      id name partnerType status organization email phone
      ${h} updatedAt
    }
  }
`,C=`
  mutation ReferralUpdatePartner($id: ID!, $input: PartnerInput!) {
    updatePartner(id: $id, input: $input) {
      id name partnerType status organization email phone
      ${h} feedbackNotes updatedAt
    }
  }
`;var v=`
  mutation ReferralCreateTask($input: TaskInput!) {
    createTask(input: $input) { id title status dueAt }
  }
`,k=`
  mutation ReferralLogActivity($input: LogActivityInput!) {
    logActivity(input: $input) { id }
  }
`;var N={client:"Client",investor:"Investor",mandate:"Mandate",transaction:"Transaction",engagement:"Engagement",partner:"Partner"};function $(t,e,n){let i=N[e],s=t.filter(r=>r.type===i);if(s.length===0)return{kind:"none"};let y=s.find(r=>r.id===n);if(y)return{kind:"match",result:y};let p=n.trim().toLowerCase(),d=s.filter(r=>r.title.trim().toLowerCase()===p);return d.length===1?{kind:"match",result:d[0]}:s.length===1?{kind:"match",result:s[0]}:{kind:"ambiguous",candidates:s.slice(0,5)}}function P(t){return/^c[a-z0-9]{20,32}$/i.test(t.trim())}function F(t,e){let n=new Date(t),i=e;for(;i>0;){n.setUTCDate(n.getUTCDate()+1);let s=n.getUTCDay();s!==0&&s!==6&&(i-=1)}return n}var z="Created by Referral Partner Agent",K=a.z.object({partnerType:a.z.enum(["LawFirm","Auditor","Advisor","Bank","InvestmentBank","Consulting","Other"]).optional(),advisorType:a.z.enum(["Lawyer","Investor","Consultant","TransactionAdvisor","AdvisoryFirm","Other"]).optional(),organization:a.z.string().optional(),email:a.z.string().optional(),phone:a.z.string().optional(),location:a.z.string().optional(),profile:a.z.string().optional().describe("Short description of who the partner is")}),O=a.z.object({partner:a.z.string().min(1).describe("The introducing partner \u2014 name as the user said it, or an exact id"),partnerAction:a.z.enum(["create_new","use_existing"]).describe("Whether this introduction creates a NEW partner record or attaches to an EXISTING one. The confirmation you asked the user must have stated which."),introduced:a.z.string().min(1).describe("Who/what was introduced \u2014 the company or opportunity, as the user described it"),details:a.z.string().optional().describe("Any context the user gave: sector, size, timing, how the introduction happened"),partnerFields:K.optional().describe("Partner contact/profile details to store on the partner record"),existingDealId:a.z.string().optional().describe("Only when the introduction concerns a deal already in the CRM \u2014 its exact id from a previous lookup"),existingDealType:a.z.enum(["mandate","transaction"]).optional().describe("Required when existingDealId is set"),createAnyway:a.z.boolean().optional().describe("Only after the user has seen the possible duplicates and still wants a new partner record"),reason:a.z.string().min(1).describe("One line explaining the entry \u2014 written to the CRM audit trail"),confirmed:a.z.literal(!0).describe("Only pass true after the user has explicitly confirmed this exact introduction \u2014 including whether the partner record is new or existing \u2014 in this conversation. If you have not asked yet, ask first \u2014 do not call this tool.")}),R=class{constructor(e){this.deps=e}deps;name="record_introduction";description="Record a partner introduction: create or update the Partner record and file a review task for staff (due in 3 business days). Does NOT create a deal \u2014 deals are only created by staff after review, or via create_referred_mandate when explicitly instructed. REQUIRES prior user confirmation stating whether the partner record is new or existing.";inputSchema=O;async execute(e){let n=O.safeParse(e);if(!n.success)return{status:"rejected",message:`Invalid input: ${n.error.issues[0]?.message??"schema mismatch"}. Writes require confirmed: true after explicit user approval.`};if(e.existingDealId&&!e.existingDealType)return{status:"rejected",message:"existingDealType is required when existingDealId is set."};let i=this.deps?.crm??x(),s=this.deps?.now?this.deps.now():new Date,y=await i.query(_,{query:e.partner,limit:10}),p=$(y.globalSearch,"partner",e.partner),d,r,c;if(e.partnerAction==="use_existing"){let l=null;if(p.kind==="match")l={id:p.result.id,title:p.result.title};else if(p.kind==="none"&&P(e.partner))try{let o=await i.query(b,{id:e.partner.trim()});o.partner&&(l={id:o.partner.id,title:o.partner.name})}catch{}if(!l)return p.kind==="ambiguous"?{status:"ambiguous",message:"Multiple partners match \u2014 ask the user to pick one, then call again with the chosen id.",candidates:p.candidates.map(o=>({id:o.id,title:o.title,subtitle:o.subtitle??null}))}:{status:"partner_not_found",message:`No existing partner matching "${e.partner}" \u2014 if this is a new partner, confirm create-new with the user and call again with partnerAction: "create_new".`};d=l.id,r=l.title,c=!1;let I=Object.fromEntries(Object.entries(e.partnerFields??{}).filter(([,o])=>o!==void 0));if(Object.keys(I).length>0)try{await i.query(C,{id:d,input:{name:r,...I}})}catch(o){if(o instanceof m&&o.message!==f)return{status:"blocked",message:o.message};throw o}}else{let l=y.globalSearch.filter(u=>u.type==="Partner");if(l.length>0&&!e.createAnyway)return{status:"possible_duplicate",message:'Partners with similar names already exist. Show them to the user; if they want one of these, call again with partnerAction: "use_existing" and the chosen id \u2014 otherwise call again with createAnyway: true.',candidates:l.slice(0,5).map(u=>({id:u.id,title:u.title,subtitle:u.subtitle??null}))};let I=Object.fromEntries(Object.entries(e.partnerFields??{}).filter(([,u])=>u!==void 0)),o;try{o=(await i.query(D,{input:{name:e.partner.trim(),...I}})).createPartner}catch(u){if(u instanceof m&&u.message!==f)return{status:"blocked",message:u.message};throw u}d=o.id,r=o.name,c=!0}let M=e.existingDealId&&e.existingDealType?{[e.existingDealType==="mandate"?"mandateId":"transactionId"]:e.existingDealId}:{},T;try{T=(await i.query(v,{input:{title:`Review referral introduction: ${e.introduced} (introduced by ${r})`,body:[e.details,e.reason,`${z} (record_introduction).`].filter(Boolean).join(`
`),status:"NotStarted",source:"Other",dueAt:F(s,3).toISOString(),...M}})).createTask}catch(l){if(l instanceof m&&l.message!==f)return{status:"partial",message:`The partner record was ${c?"created":"updated"}, but the review task failed: ${l.message}`,partner:{id:d,name:r,created:c},link:`${i.baseUrl}/partners/${d}`};throw l}let E=!1;if(e.existingDealId&&e.existingDealType)try{await i.query(k,{input:{type:"Note",subject:"Referral Partner Agent: introduction recorded",body:`${e.reason}
Introduced: ${e.introduced} (by ${r})`,[e.existingDealType==="mandate"?"mandateId":"transactionId"]:e.existingDealId}}),E=!0}catch{}return{status:"ok",partner:{id:d,name:r,created:c},reviewTask:{id:T.id,title:T.title,dueAt:T.dueAt??null},auditLogged:E,link:`${i.baseUrl}/partners/${d}`}}};var g=new R,H={version:"2.0.0",kind:"tool",name:"record_introduction",description:"Record a partner introduction: create or update the Partner record and file a review task for staff (due in 3 business days). Does NOT create a deal \u2014 deals are only created by staff after review, or via create_referred_mandate when explicitly instructed. REQUIRES prior user confirmation stating whether the partner record is new or existing.",exportName:"RecordIntroductionTool",pattern:"class-definition"},W={__lua_primitive__:H,primitive:{kind:"tool",name:g.name??"record_introduction",description:g.description??"Record a partner introduction: create or update the Partner record and file a review task for staff (due in 3 business days). Does NOT create a deal \u2014 deals are only created by staff after review, or via create_referred_mandate when explicitly instructed. REQUIRES prior user confirmation stating whether the partner record is new or existing.",inputSchema:g.inputSchema,execute:typeof g.execute=="function"?g.execute.bind(g):void 0,condition:typeof g.condition=="function"?g.condition.bind(g):void 0}};0&&(module.exports={RecordIntroductionTool});
