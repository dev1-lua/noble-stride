/* eslint-disable */
import type { Prisma, User, Person, Investor, BlockedRegistration, Client, Mandate, Transaction, Engagement, EngagementMilestone, DueDiligenceTrack, Partner, Activity, Task, ServiceProvider, Document, StageChange, SavedView, Notification } from "D:\\LuaWork\\NobleStride\\noble-stride\\noblestride-crm\\node_modules\\.pnpm\\@prisma+client@6.19.3_prism_1d040ab5215f59f0e27ddee7f0cf082e\\node_modules\\@prisma\\client/index.js";
import type { PothosPrismaDatamodel } from "@pothos/plugin-prisma";
export default interface PrismaTypes {
    User: {
        Name: "User";
        Shape: User;
        Include: Prisma.UserInclude;
        Select: Prisma.UserSelect;
        OrderBy: Prisma.UserOrderByWithRelationInput;
        WhereUnique: Prisma.UserWhereUniqueInput;
        Where: Prisma.UserWhereInput;
        Create: {};
        Update: {};
        RelationName: "ledMandates" | "ownedTransactions" | "ownedEngagements" | "ddTracks" | "activities" | "assignedTasks" | "documents" | "reviewedDocuments" | "approvedDocuments" | "assistantTransactions" | "assistantTasks" | "stageChanges" | "savedViews" | "notifications";
        ListRelations: "ledMandates" | "ownedTransactions" | "ownedEngagements" | "ddTracks" | "activities" | "assignedTasks" | "documents" | "reviewedDocuments" | "approvedDocuments" | "assistantTransactions" | "assistantTasks" | "stageChanges" | "savedViews" | "notifications";
        Relations: {
            ledMandates: {
                Shape: Mandate[];
                Name: "Mandate";
                Nullable: false;
            };
            ownedTransactions: {
                Shape: Transaction[];
                Name: "Transaction";
                Nullable: false;
            };
            ownedEngagements: {
                Shape: Engagement[];
                Name: "Engagement";
                Nullable: false;
            };
            ddTracks: {
                Shape: DueDiligenceTrack[];
                Name: "DueDiligenceTrack";
                Nullable: false;
            };
            activities: {
                Shape: Activity[];
                Name: "Activity";
                Nullable: false;
            };
            assignedTasks: {
                Shape: Task[];
                Name: "Task";
                Nullable: false;
            };
            documents: {
                Shape: Document[];
                Name: "Document";
                Nullable: false;
            };
            reviewedDocuments: {
                Shape: Document[];
                Name: "Document";
                Nullable: false;
            };
            approvedDocuments: {
                Shape: Document[];
                Name: "Document";
                Nullable: false;
            };
            assistantTransactions: {
                Shape: Transaction[];
                Name: "Transaction";
                Nullable: false;
            };
            assistantTasks: {
                Shape: Task[];
                Name: "Task";
                Nullable: false;
            };
            stageChanges: {
                Shape: StageChange[];
                Name: "StageChange";
                Nullable: false;
            };
            savedViews: {
                Shape: SavedView[];
                Name: "SavedView";
                Nullable: false;
            };
            notifications: {
                Shape: Notification[];
                Name: "Notification";
                Nullable: false;
            };
        };
    };
    Person: {
        Name: "Person";
        Shape: Person;
        Include: Prisma.PersonInclude;
        Select: Prisma.PersonSelect;
        OrderBy: Prisma.PersonOrderByWithRelationInput;
        WhereUnique: Prisma.PersonWhereUniqueInput;
        Where: Prisma.PersonWhereInput;
        Create: {};
        Update: {};
        RelationName: "investor" | "client" | "partner" | "ssaForInvestors";
        ListRelations: "ssaForInvestors";
        Relations: {
            investor: {
                Shape: Investor | null;
                Name: "Investor";
                Nullable: true;
            };
            client: {
                Shape: Client | null;
                Name: "Client";
                Nullable: true;
            };
            partner: {
                Shape: Partner | null;
                Name: "Partner";
                Nullable: true;
            };
            ssaForInvestors: {
                Shape: Investor[];
                Name: "Investor";
                Nullable: false;
            };
        };
    };
    Investor: {
        Name: "Investor";
        Shape: Investor;
        Include: Prisma.InvestorInclude;
        Select: Prisma.InvestorSelect;
        OrderBy: Prisma.InvestorOrderByWithRelationInput;
        WhereUnique: Prisma.InvestorWhereUniqueInput;
        Where: Prisma.InvestorWhereInput;
        Create: {};
        Update: {};
        RelationName: "ssaRegionContact" | "contacts" | "engagements" | "activities" | "tasks" | "documents" | "stageChanges" | "blockedRegistrations";
        ListRelations: "contacts" | "engagements" | "activities" | "tasks" | "documents" | "stageChanges" | "blockedRegistrations";
        Relations: {
            ssaRegionContact: {
                Shape: Person | null;
                Name: "Person";
                Nullable: true;
            };
            contacts: {
                Shape: Person[];
                Name: "Person";
                Nullable: false;
            };
            engagements: {
                Shape: Engagement[];
                Name: "Engagement";
                Nullable: false;
            };
            activities: {
                Shape: Activity[];
                Name: "Activity";
                Nullable: false;
            };
            tasks: {
                Shape: Task[];
                Name: "Task";
                Nullable: false;
            };
            documents: {
                Shape: Document[];
                Name: "Document";
                Nullable: false;
            };
            stageChanges: {
                Shape: StageChange[];
                Name: "StageChange";
                Nullable: false;
            };
            blockedRegistrations: {
                Shape: BlockedRegistration[];
                Name: "BlockedRegistration";
                Nullable: false;
            };
        };
    };
    BlockedRegistration: {
        Name: "BlockedRegistration";
        Shape: BlockedRegistration;
        Include: Prisma.BlockedRegistrationInclude;
        Select: Prisma.BlockedRegistrationSelect;
        OrderBy: Prisma.BlockedRegistrationOrderByWithRelationInput;
        WhereUnique: Prisma.BlockedRegistrationWhereUniqueInput;
        Where: Prisma.BlockedRegistrationWhereInput;
        Create: {};
        Update: {};
        RelationName: "investor";
        ListRelations: never;
        Relations: {
            investor: {
                Shape: Investor | null;
                Name: "Investor";
                Nullable: true;
            };
        };
    };
    Client: {
        Name: "Client";
        Shape: Client;
        Include: Prisma.ClientInclude;
        Select: Prisma.ClientSelect;
        OrderBy: Prisma.ClientOrderByWithRelationInput;
        WhereUnique: Prisma.ClientWhereUniqueInput;
        Where: Prisma.ClientWhereInput;
        Create: {};
        Update: {};
        RelationName: "contacts" | "mandates" | "transactions" | "tasks" | "documents" | "activities" | "stageChanges";
        ListRelations: "contacts" | "mandates" | "transactions" | "tasks" | "documents" | "activities" | "stageChanges";
        Relations: {
            contacts: {
                Shape: Person[];
                Name: "Person";
                Nullable: false;
            };
            mandates: {
                Shape: Mandate[];
                Name: "Mandate";
                Nullable: false;
            };
            transactions: {
                Shape: Transaction[];
                Name: "Transaction";
                Nullable: false;
            };
            tasks: {
                Shape: Task[];
                Name: "Task";
                Nullable: false;
            };
            documents: {
                Shape: Document[];
                Name: "Document";
                Nullable: false;
            };
            activities: {
                Shape: Activity[];
                Name: "Activity";
                Nullable: false;
            };
            stageChanges: {
                Shape: StageChange[];
                Name: "StageChange";
                Nullable: false;
            };
        };
    };
    Mandate: {
        Name: "Mandate";
        Shape: Mandate;
        Include: Prisma.MandateInclude;
        Select: Prisma.MandateSelect;
        OrderBy: Prisma.MandateOrderByWithRelationInput;
        WhereUnique: Prisma.MandateWhereUniqueInput;
        Where: Prisma.MandateWhereInput;
        Create: {};
        Update: {};
        RelationName: "client" | "lead" | "referredBy" | "transactions" | "activities" | "tasks" | "documents" | "stageChanges";
        ListRelations: "transactions" | "activities" | "tasks" | "documents" | "stageChanges";
        Relations: {
            client: {
                Shape: Client;
                Name: "Client";
                Nullable: false;
            };
            lead: {
                Shape: User | null;
                Name: "User";
                Nullable: true;
            };
            referredBy: {
                Shape: Partner | null;
                Name: "Partner";
                Nullable: true;
            };
            transactions: {
                Shape: Transaction[];
                Name: "Transaction";
                Nullable: false;
            };
            activities: {
                Shape: Activity[];
                Name: "Activity";
                Nullable: false;
            };
            tasks: {
                Shape: Task[];
                Name: "Task";
                Nullable: false;
            };
            documents: {
                Shape: Document[];
                Name: "Document";
                Nullable: false;
            };
            stageChanges: {
                Shape: StageChange[];
                Name: "StageChange";
                Nullable: false;
            };
        };
    };
    Transaction: {
        Name: "Transaction";
        Shape: Transaction;
        Include: Prisma.TransactionInclude;
        Select: Prisma.TransactionSelect;
        OrderBy: Prisma.TransactionOrderByWithRelationInput;
        WhereUnique: Prisma.TransactionWhereUniqueInput;
        Where: Prisma.TransactionWhereInput;
        Create: {};
        Update: {};
        RelationName: "client" | "mandate" | "owner" | "assistant" | "referredBy" | "engagements" | "activities" | "tasks" | "serviceProviders" | "documents" | "stageChanges" | "ddTracks";
        ListRelations: "engagements" | "activities" | "tasks" | "serviceProviders" | "documents" | "stageChanges" | "ddTracks";
        Relations: {
            client: {
                Shape: Client;
                Name: "Client";
                Nullable: false;
            };
            mandate: {
                Shape: Mandate | null;
                Name: "Mandate";
                Nullable: true;
            };
            owner: {
                Shape: User | null;
                Name: "User";
                Nullable: true;
            };
            assistant: {
                Shape: User | null;
                Name: "User";
                Nullable: true;
            };
            referredBy: {
                Shape: Partner | null;
                Name: "Partner";
                Nullable: true;
            };
            engagements: {
                Shape: Engagement[];
                Name: "Engagement";
                Nullable: false;
            };
            activities: {
                Shape: Activity[];
                Name: "Activity";
                Nullable: false;
            };
            tasks: {
                Shape: Task[];
                Name: "Task";
                Nullable: false;
            };
            serviceProviders: {
                Shape: ServiceProvider[];
                Name: "ServiceProvider";
                Nullable: false;
            };
            documents: {
                Shape: Document[];
                Name: "Document";
                Nullable: false;
            };
            stageChanges: {
                Shape: StageChange[];
                Name: "StageChange";
                Nullable: false;
            };
            ddTracks: {
                Shape: DueDiligenceTrack[];
                Name: "DueDiligenceTrack";
                Nullable: false;
            };
        };
    };
    Engagement: {
        Name: "Engagement";
        Shape: Engagement;
        Include: Prisma.EngagementInclude;
        Select: Prisma.EngagementSelect;
        OrderBy: Prisma.EngagementOrderByWithRelationInput;
        WhereUnique: Prisma.EngagementWhereUniqueInput;
        Where: Prisma.EngagementWhereInput;
        Create: {};
        Update: {};
        RelationName: "transaction" | "investor" | "owner" | "activities" | "milestones" | "stageChanges";
        ListRelations: "activities" | "milestones" | "stageChanges";
        Relations: {
            transaction: {
                Shape: Transaction;
                Name: "Transaction";
                Nullable: false;
            };
            investor: {
                Shape: Investor;
                Name: "Investor";
                Nullable: false;
            };
            owner: {
                Shape: User | null;
                Name: "User";
                Nullable: true;
            };
            activities: {
                Shape: Activity[];
                Name: "Activity";
                Nullable: false;
            };
            milestones: {
                Shape: EngagementMilestone[];
                Name: "EngagementMilestone";
                Nullable: false;
            };
            stageChanges: {
                Shape: StageChange[];
                Name: "StageChange";
                Nullable: false;
            };
        };
    };
    EngagementMilestone: {
        Name: "EngagementMilestone";
        Shape: EngagementMilestone;
        Include: Prisma.EngagementMilestoneInclude;
        Select: Prisma.EngagementMilestoneSelect;
        OrderBy: Prisma.EngagementMilestoneOrderByWithRelationInput;
        WhereUnique: Prisma.EngagementMilestoneWhereUniqueInput;
        Where: Prisma.EngagementMilestoneWhereInput;
        Create: {};
        Update: {};
        RelationName: "engagement";
        ListRelations: never;
        Relations: {
            engagement: {
                Shape: Engagement;
                Name: "Engagement";
                Nullable: false;
            };
        };
    };
    DueDiligenceTrack: {
        Name: "DueDiligenceTrack";
        Shape: DueDiligenceTrack;
        Include: Prisma.DueDiligenceTrackInclude;
        Select: Prisma.DueDiligenceTrackSelect;
        OrderBy: Prisma.DueDiligenceTrackOrderByWithRelationInput;
        WhereUnique: Prisma.DueDiligenceTrackWhereUniqueInput;
        Where: Prisma.DueDiligenceTrackWhereInput;
        Create: {};
        Update: {};
        RelationName: "transaction" | "owner" | "serviceProvider";
        ListRelations: never;
        Relations: {
            transaction: {
                Shape: Transaction;
                Name: "Transaction";
                Nullable: false;
            };
            owner: {
                Shape: User | null;
                Name: "User";
                Nullable: true;
            };
            serviceProvider: {
                Shape: ServiceProvider | null;
                Name: "ServiceProvider";
                Nullable: true;
            };
        };
    };
    Partner: {
        Name: "Partner";
        Shape: Partner;
        Include: Prisma.PartnerInclude;
        Select: Prisma.PartnerSelect;
        OrderBy: Prisma.PartnerOrderByWithRelationInput;
        WhereUnique: Prisma.PartnerWhereUniqueInput;
        Where: Prisma.PartnerWhereInput;
        Create: {};
        Update: {};
        RelationName: "contacts" | "referredMandates" | "referredTransactions" | "stageChanges" | "documents";
        ListRelations: "contacts" | "referredMandates" | "referredTransactions" | "stageChanges" | "documents";
        Relations: {
            contacts: {
                Shape: Person[];
                Name: "Person";
                Nullable: false;
            };
            referredMandates: {
                Shape: Mandate[];
                Name: "Mandate";
                Nullable: false;
            };
            referredTransactions: {
                Shape: Transaction[];
                Name: "Transaction";
                Nullable: false;
            };
            stageChanges: {
                Shape: StageChange[];
                Name: "StageChange";
                Nullable: false;
            };
            documents: {
                Shape: Document[];
                Name: "Document";
                Nullable: false;
            };
        };
    };
    Activity: {
        Name: "Activity";
        Shape: Activity;
        Include: Prisma.ActivityInclude;
        Select: Prisma.ActivitySelect;
        OrderBy: Prisma.ActivityOrderByWithRelationInput;
        WhereUnique: Prisma.ActivityWhereUniqueInput;
        Where: Prisma.ActivityWhereInput;
        Create: {};
        Update: {};
        RelationName: "engagement" | "transaction" | "investor" | "mandate" | "client" | "createdBy" | "tasks";
        ListRelations: "tasks";
        Relations: {
            engagement: {
                Shape: Engagement | null;
                Name: "Engagement";
                Nullable: true;
            };
            transaction: {
                Shape: Transaction | null;
                Name: "Transaction";
                Nullable: true;
            };
            investor: {
                Shape: Investor | null;
                Name: "Investor";
                Nullable: true;
            };
            mandate: {
                Shape: Mandate | null;
                Name: "Mandate";
                Nullable: true;
            };
            client: {
                Shape: Client | null;
                Name: "Client";
                Nullable: true;
            };
            createdBy: {
                Shape: User | null;
                Name: "User";
                Nullable: true;
            };
            tasks: {
                Shape: Task[];
                Name: "Task";
                Nullable: false;
            };
        };
    };
    Task: {
        Name: "Task";
        Shape: Task;
        Include: Prisma.TaskInclude;
        Select: Prisma.TaskSelect;
        OrderBy: Prisma.TaskOrderByWithRelationInput;
        WhereUnique: Prisma.TaskWhereUniqueInput;
        Where: Prisma.TaskWhereInput;
        Create: {};
        Update: {};
        RelationName: "assignee" | "mandate" | "transaction" | "investor" | "client" | "assistant" | "activity";
        ListRelations: never;
        Relations: {
            assignee: {
                Shape: User | null;
                Name: "User";
                Nullable: true;
            };
            mandate: {
                Shape: Mandate | null;
                Name: "Mandate";
                Nullable: true;
            };
            transaction: {
                Shape: Transaction | null;
                Name: "Transaction";
                Nullable: true;
            };
            investor: {
                Shape: Investor | null;
                Name: "Investor";
                Nullable: true;
            };
            client: {
                Shape: Client | null;
                Name: "Client";
                Nullable: true;
            };
            assistant: {
                Shape: User | null;
                Name: "User";
                Nullable: true;
            };
            activity: {
                Shape: Activity | null;
                Name: "Activity";
                Nullable: true;
            };
        };
    };
    ServiceProvider: {
        Name: "ServiceProvider";
        Shape: ServiceProvider;
        Include: Prisma.ServiceProviderInclude;
        Select: Prisma.ServiceProviderSelect;
        OrderBy: Prisma.ServiceProviderOrderByWithRelationInput;
        WhereUnique: Prisma.ServiceProviderWhereUniqueInput;
        Where: Prisma.ServiceProviderWhereInput;
        Create: {};
        Update: {};
        RelationName: "engagedOn" | "ddTracks";
        ListRelations: "engagedOn" | "ddTracks";
        Relations: {
            engagedOn: {
                Shape: Transaction[];
                Name: "Transaction";
                Nullable: false;
            };
            ddTracks: {
                Shape: DueDiligenceTrack[];
                Name: "DueDiligenceTrack";
                Nullable: false;
            };
        };
    };
    Document: {
        Name: "Document";
        Shape: Document;
        Include: Prisma.DocumentInclude;
        Select: Prisma.DocumentSelect;
        OrderBy: Prisma.DocumentOrderByWithRelationInput;
        WhereUnique: Prisma.DocumentWhereUniqueInput;
        Where: Prisma.DocumentWhereInput;
        Create: {};
        Update: {};
        RelationName: "uploadedBy" | "reviewer" | "approver" | "transaction" | "client" | "investor" | "mandate" | "partner";
        ListRelations: never;
        Relations: {
            uploadedBy: {
                Shape: User | null;
                Name: "User";
                Nullable: true;
            };
            reviewer: {
                Shape: User | null;
                Name: "User";
                Nullable: true;
            };
            approver: {
                Shape: User | null;
                Name: "User";
                Nullable: true;
            };
            transaction: {
                Shape: Transaction | null;
                Name: "Transaction";
                Nullable: true;
            };
            client: {
                Shape: Client | null;
                Name: "Client";
                Nullable: true;
            };
            investor: {
                Shape: Investor | null;
                Name: "Investor";
                Nullable: true;
            };
            mandate: {
                Shape: Mandate | null;
                Name: "Mandate";
                Nullable: true;
            };
            partner: {
                Shape: Partner | null;
                Name: "Partner";
                Nullable: true;
            };
        };
    };
    StageChange: {
        Name: "StageChange";
        Shape: StageChange;
        Include: Prisma.StageChangeInclude;
        Select: Prisma.StageChangeSelect;
        OrderBy: Prisma.StageChangeOrderByWithRelationInput;
        WhereUnique: Prisma.StageChangeWhereUniqueInput;
        Where: Prisma.StageChangeWhereInput;
        Create: {};
        Update: {};
        RelationName: "changedBy" | "mandate" | "transaction" | "engagement" | "client" | "investor" | "partner";
        ListRelations: never;
        Relations: {
            changedBy: {
                Shape: User | null;
                Name: "User";
                Nullable: true;
            };
            mandate: {
                Shape: Mandate | null;
                Name: "Mandate";
                Nullable: true;
            };
            transaction: {
                Shape: Transaction | null;
                Name: "Transaction";
                Nullable: true;
            };
            engagement: {
                Shape: Engagement | null;
                Name: "Engagement";
                Nullable: true;
            };
            client: {
                Shape: Client | null;
                Name: "Client";
                Nullable: true;
            };
            investor: {
                Shape: Investor | null;
                Name: "Investor";
                Nullable: true;
            };
            partner: {
                Shape: Partner | null;
                Name: "Partner";
                Nullable: true;
            };
        };
    };
    SavedView: {
        Name: "SavedView";
        Shape: SavedView;
        Include: Prisma.SavedViewInclude;
        Select: Prisma.SavedViewSelect;
        OrderBy: Prisma.SavedViewOrderByWithRelationInput;
        WhereUnique: Prisma.SavedViewWhereUniqueInput;
        Where: Prisma.SavedViewWhereInput;
        Create: {};
        Update: {};
        RelationName: "createdBy";
        ListRelations: never;
        Relations: {
            createdBy: {
                Shape: User | null;
                Name: "User";
                Nullable: true;
            };
        };
    };
    Notification: {
        Name: "Notification";
        Shape: Notification;
        Include: Prisma.NotificationInclude;
        Select: Prisma.NotificationSelect;
        OrderBy: Prisma.NotificationOrderByWithRelationInput;
        WhereUnique: Prisma.NotificationWhereUniqueInput;
        Where: Prisma.NotificationWhereInput;
        Create: {};
        Update: {};
        RelationName: "user";
        ListRelations: never;
        Relations: {
            user: {
                Shape: User;
                Name: "User";
                Nullable: false;
            };
        };
    };
}
export function getDatamodel(): PothosPrismaDatamodel { return JSON.parse("{\"datamodel\":{\"models\":{\"User\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"email\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":true,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"jobTitle\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"avatarColor\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"isActive\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"OrgRole\",\"kind\":\"enum\",\"name\":\"role\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true},{\"type\":\"Mandate\",\"kind\":\"object\",\"name\":\"ledMandates\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"MandateLead\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Transaction\",\"kind\":\"object\",\"name\":\"ownedTransactions\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"TransactionOwner\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Engagement\",\"kind\":\"object\",\"name\":\"ownedEngagements\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"EngagementOwner\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DueDiligenceTrack\",\"kind\":\"object\",\"name\":\"ddTracks\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DDTrackOwner\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Activity\",\"kind\":\"object\",\"name\":\"activities\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ActivityCreatedBy\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Task\",\"kind\":\"object\",\"name\":\"assignedTasks\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"TaskAssignee\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Document\",\"kind\":\"object\",\"name\":\"documents\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DocumentUploadedBy\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Document\",\"kind\":\"object\",\"name\":\"reviewedDocuments\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DocumentReviewer\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Document\",\"kind\":\"object\",\"name\":\"approvedDocuments\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DocumentApprover\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Transaction\",\"kind\":\"object\",\"name\":\"assistantTransactions\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"TransactionAssistant\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Task\",\"kind\":\"object\",\"name\":\"assistantTasks\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"TaskAssistant\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"StageChange\",\"kind\":\"object\",\"name\":\"stageChanges\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"StageChangeActor\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"SavedView\",\"kind\":\"object\",\"name\":\"savedViews\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"SavedViewCreatedBy\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Notification\",\"kind\":\"object\",\"name\":\"notifications\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"NotificationToUser\",\"relationFromFields\":[],\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"Person\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"firstName\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"lastName\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"email\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"phone\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"jobTitle\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"linkedinUrl\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"isPrimaryContact\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"isSSAContact\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"investorId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Investor\",\"kind\":\"object\",\"name\":\"investor\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"InvestorToPerson\",\"relationFromFields\":[\"investorId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"clientId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Client\",\"kind\":\"object\",\"name\":\"client\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ClientToPerson\",\"relationFromFields\":[\"clientId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"partnerId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Partner\",\"kind\":\"object\",\"name\":\"partner\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"PartnerToPerson\",\"relationFromFields\":[\"partnerId\"],\"isUpdatedAt\":false},{\"type\":\"Investor\",\"kind\":\"object\",\"name\":\"ssaForInvestors\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"InvestorSsaContact\",\"relationFromFields\":[],\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"Investor\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"InvestorType\",\"kind\":\"enum\",\"name\":\"investorType\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"website\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"InvestorStatus\",\"kind\":\"enum\",\"name\":\"status\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Sector\",\"kind\":\"enum\",\"name\":\"sectorFocus\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Geography\",\"kind\":\"enum\",\"name\":\"geographicFocus\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Instrument\",\"kind\":\"enum\",\"name\":\"instruments\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"InvestmentStage\",\"kind\":\"enum\",\"name\":\"investmentStages\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"aum\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"ticketMin\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"ticketMax\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"currency\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Float\",\"kind\":\"scalar\",\"name\":\"targetIrr\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"countryRestrictions\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"esgFocus\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"decisionProcess\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"notes\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"InvestorEngagementClassification\",\"kind\":\"enum\",\"name\":\"engagementClassification\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"InvestorNdaStatus\",\"kind\":\"enum\",\"name\":\"ndaStatus\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"OnboardingStatus\",\"kind\":\"enum\",\"name\":\"onboardingStatus\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"emailVerifiedAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"phoneVerifiedAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"registeredAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"openNdaSignedAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"shareholdingPreference\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"minRevenue\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"minEbitda\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"minLoanBook\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"pricingPreference\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"remainingInvestmentPeriod\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"ddRequirements\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"icApprovalProcess\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"trackRecord\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"investmentMandate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"nextActionDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"feedback\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"notableInvestments\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"portfolioComposition\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"caseStudies\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"reinvestmentPolicy\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"teamComposition\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"collaborationTerms\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"impactMetrics\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"reputationalRisks\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"ssaRegionContactId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Person\",\"kind\":\"object\",\"name\":\"ssaRegionContact\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"InvestorSsaContact\",\"relationFromFields\":[\"ssaRegionContactId\"],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"criteriaVerifiedAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"ActorSource\",\"kind\":\"enum\",\"name\":\"createdSource\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true},{\"type\":\"Person\",\"kind\":\"object\",\"name\":\"contacts\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"InvestorToPerson\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Engagement\",\"kind\":\"object\",\"name\":\"engagements\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"EngagementToInvestor\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Activity\",\"kind\":\"object\",\"name\":\"activities\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ActivityToInvestor\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Task\",\"kind\":\"object\",\"name\":\"tasks\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"InvestorToTask\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Document\",\"kind\":\"object\",\"name\":\"documents\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DocumentToInvestor\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"StageChange\",\"kind\":\"object\",\"name\":\"stageChanges\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"InvestorToStageChange\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"BlockedRegistration\",\"kind\":\"object\",\"name\":\"blockedRegistrations\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BlockedRegistrationToInvestor\",\"relationFromFields\":[],\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"BlockedRegistration\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"BlockedRegistrationKind\",\"kind\":\"enum\",\"name\":\"kind\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"value\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"reason\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"investorId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Investor\",\"kind\":\"object\",\"name\":\"investor\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"BlockedRegistrationToInvestor\",\"relationFromFields\":[\"investorId\"],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"kind\",\"value\"]}]},\"Client\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Int\",\"kind\":\"scalar\",\"name\":\"yearFounded\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"hqCity\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Geography\",\"kind\":\"enum\",\"name\":\"countries\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"website\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Sector\",\"kind\":\"enum\",\"name\":\"sector\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"coreProduct\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"description\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"founders\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"FounderGender\",\"kind\":\"enum\",\"name\":\"founderGenders\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"revenueLastYear\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"revenueForecast\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"currency\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Profitability\",\"kind\":\"enum\",\"name\":\"profitability\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"existingInvestors\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Source\",\"kind\":\"enum\",\"name\":\"source\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"pitchDeckUrl\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"codename\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"registrationNo\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"hqCountry\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"businessModel\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"foundersNationality\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"ownershipStructure\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"directorsManagement\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"targetClients\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Int\",\"kind\":\"scalar\",\"name\":\"staffCount\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Int\",\"kind\":\"scalar\",\"name\":\"branchCount\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"ebitda\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"netProfit\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"existingDebt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"loanBook\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"totalAssets\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"ImpactFlag\",\"kind\":\"enum\",\"name\":\"impactFlags\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"ClientStatus\",\"kind\":\"enum\",\"name\":\"status\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"pepExposure\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"governmentOwned\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"complianceNotes\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Int\",\"kind\":\"scalar\",\"name\":\"auditedFinancialsYears\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"groupStructure\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"suppliers\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"competitors\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"capacityUtilization\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"repaymentAbilityNotes\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"pricingExpectations\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"proposedTimeline\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"ActorSource\",\"kind\":\"enum\",\"name\":\"createdSource\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true},{\"type\":\"Person\",\"kind\":\"object\",\"name\":\"contacts\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ClientToPerson\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Mandate\",\"kind\":\"object\",\"name\":\"mandates\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ClientToMandate\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Transaction\",\"kind\":\"object\",\"name\":\"transactions\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ClientToTransaction\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Task\",\"kind\":\"object\",\"name\":\"tasks\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ClientToTask\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Document\",\"kind\":\"object\",\"name\":\"documents\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ClientToDocument\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Activity\",\"kind\":\"object\",\"name\":\"activities\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ActivityToClient\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"StageChange\",\"kind\":\"object\",\"name\":\"stageChanges\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ClientToStageChange\",\"relationFromFields\":[],\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"Mandate\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"MandateStage\",\"kind\":\"enum\",\"name\":\"stage\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"stageEnteredAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DealStatus\",\"kind\":\"enum\",\"name\":\"dealStatus\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"dealSize\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"currency\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Sector\",\"kind\":\"enum\",\"name\":\"sector\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Source\",\"kind\":\"enum\",\"name\":\"source\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"dateOpened\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DocStatus\",\"kind\":\"enum\",\"name\":\"ndaStatus\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"ndaSentDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"ndaSignedDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DocStatus\",\"kind\":\"enum\",\"name\":\"eaStatus\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"eaSentDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"eaSignedDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"nextAction\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"notes\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"retainerAmount\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"retainerInvoicedDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"retainerPaidDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Priority\",\"kind\":\"enum\",\"name\":\"priority\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"referralQualified\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"qualificationVerdict\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"qualificationReasons\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"qualifiedAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"ActorSource\",\"kind\":\"enum\",\"name\":\"createdSource\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"clientId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Client\",\"kind\":\"object\",\"name\":\"client\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ClientToMandate\",\"relationFromFields\":[\"clientId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"leadId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"lead\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"MandateLead\",\"relationFromFields\":[\"leadId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"referredById\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Partner\",\"kind\":\"object\",\"name\":\"referredBy\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"PartnerReferral\",\"relationFromFields\":[\"referredById\"],\"isUpdatedAt\":false},{\"type\":\"Transaction\",\"kind\":\"object\",\"name\":\"transactions\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"MandateToTransaction\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Activity\",\"kind\":\"object\",\"name\":\"activities\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ActivityToMandate\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Task\",\"kind\":\"object\",\"name\":\"tasks\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"MandateToTask\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Document\",\"kind\":\"object\",\"name\":\"documents\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DocumentToMandate\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"StageChange\",\"kind\":\"object\",\"name\":\"stageChanges\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"MandateToStageChange\",\"relationFromFields\":[],\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"Transaction\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"TransactionStage\",\"kind\":\"enum\",\"name\":\"stage\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"stageEnteredAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DealType\",\"kind\":\"enum\",\"name\":\"dealType\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Instrument\",\"kind\":\"enum\",\"name\":\"instrument\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"targetRaise\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"currency\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Sector\",\"kind\":\"enum\",\"name\":\"sector\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"dateOpened\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"closedAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"successFeeAmount\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"successFeeInvoicedDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"successFeePaidDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DealStatus\",\"kind\":\"enum\",\"name\":\"dealStatus\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DealMilestone\",\"kind\":\"enum\",\"name\":\"dealMilestone\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DealFinancingType\",\"kind\":\"enum\",\"name\":\"financingType\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"MaxSellingStake\",\"kind\":\"enum\",\"name\":\"maxSellingStake\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"targetProfile\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"useOfFunds\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"vdrLink\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Int\",\"kind\":\"scalar\",\"name\":\"probability\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"notes\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"icFirstApprovalDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"icSecondApprovalDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"RegulatoryStatus\",\"kind\":\"enum\",\"name\":\"cakComesaStatus\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"cakComesaFiledDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"cakComesaApprovedDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Priority\",\"kind\":\"enum\",\"name\":\"priority\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"PartnerFeeStatus\",\"kind\":\"enum\",\"name\":\"partnerFeeStatus\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"partnerFeeAmount\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"ActorSource\",\"kind\":\"enum\",\"name\":\"createdSource\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"clientId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Client\",\"kind\":\"object\",\"name\":\"client\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ClientToTransaction\",\"relationFromFields\":[\"clientId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"mandateId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Mandate\",\"kind\":\"object\",\"name\":\"mandate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"MandateToTransaction\",\"relationFromFields\":[\"mandateId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"ownerId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"owner\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"TransactionOwner\",\"relationFromFields\":[\"ownerId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"assistantId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"assistant\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"TransactionAssistant\",\"relationFromFields\":[\"assistantId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"referredById\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Partner\",\"kind\":\"object\",\"name\":\"referredBy\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"PartnerTransactionReferral\",\"relationFromFields\":[\"referredById\"],\"isUpdatedAt\":false},{\"type\":\"Engagement\",\"kind\":\"object\",\"name\":\"engagements\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"EngagementToTransaction\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Activity\",\"kind\":\"object\",\"name\":\"activities\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ActivityToTransaction\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Task\",\"kind\":\"object\",\"name\":\"tasks\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"TaskToTransaction\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"ServiceProvider\",\"kind\":\"object\",\"name\":\"serviceProviders\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"TransactionServiceProviders\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Document\",\"kind\":\"object\",\"name\":\"documents\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DocumentToTransaction\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"StageChange\",\"kind\":\"object\",\"name\":\"stageChanges\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"StageChangeToTransaction\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DueDiligenceTrack\",\"kind\":\"object\",\"name\":\"ddTracks\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DueDiligenceTrackToTransaction\",\"relationFromFields\":[],\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"Engagement\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"EngagementStatus\",\"kind\":\"enum\",\"name\":\"status\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"lastContact\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"notes\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"ActorSource\",\"kind\":\"enum\",\"name\":\"createdSource\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true},{\"type\":\"EngagementStage\",\"kind\":\"enum\",\"name\":\"engagementStage\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"InterestLevel\",\"kind\":\"enum\",\"name\":\"interestLevel\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"NdaType\",\"kind\":\"enum\",\"name\":\"ndaType\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"ndaSignedAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"termSheetIssued\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"termSheetDate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"totalAmount\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"amountDisbursed\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"amountPending\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DisbursementStatus\",\"kind\":\"enum\",\"name\":\"disbursementStatus\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"dateReceived\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Int\",\"kind\":\"scalar\",\"name\":\"year\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Int\",\"kind\":\"scalar\",\"name\":\"quarter\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Int\",\"kind\":\"scalar\",\"name\":\"probability\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"feedback\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"transactionId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Transaction\",\"kind\":\"object\",\"name\":\"transaction\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"EngagementToTransaction\",\"relationFromFields\":[\"transactionId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"investorId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Investor\",\"kind\":\"object\",\"name\":\"investor\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"EngagementToInvestor\",\"relationFromFields\":[\"investorId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"ownerId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"owner\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"EngagementOwner\",\"relationFromFields\":[\"ownerId\"],\"isUpdatedAt\":false},{\"type\":\"Activity\",\"kind\":\"object\",\"name\":\"activities\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ActivityToEngagement\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"EngagementMilestone\",\"kind\":\"object\",\"name\":\"milestones\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"EngagementToEngagementMilestone\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"StageChange\",\"kind\":\"object\",\"name\":\"stageChanges\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"EngagementToStageChange\",\"relationFromFields\":[],\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"transactionId\",\"investorId\"]}]},\"EngagementMilestone\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"engagementId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Engagement\",\"kind\":\"object\",\"name\":\"engagement\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"EngagementToEngagementMilestone\",\"relationFromFields\":[\"engagementId\"],\"isUpdatedAt\":false},{\"type\":\"MilestoneKey\",\"kind\":\"enum\",\"name\":\"key\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"completedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"notes\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"ActorSource\",\"kind\":\"enum\",\"name\":\"createdSource\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"engagementId\",\"key\"]}]},\"DueDiligenceTrack\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"DDTrack\",\"kind\":\"enum\",\"name\":\"track\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DDStatus\",\"kind\":\"enum\",\"name\":\"status\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"startedAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"completedAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"notes\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"transactionId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Transaction\",\"kind\":\"object\",\"name\":\"transaction\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DueDiligenceTrackToTransaction\",\"relationFromFields\":[\"transactionId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"ownerId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"owner\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DDTrackOwner\",\"relationFromFields\":[\"ownerId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"serviceProviderId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"ServiceProvider\",\"kind\":\"object\",\"name\":\"serviceProvider\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DDTrackProvider\",\"relationFromFields\":[\"serviceProviderId\"],\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"transactionId\",\"track\"]}]},\"Partner\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"PartnerType\",\"kind\":\"enum\",\"name\":\"partnerType\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"profile\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"PartnerStatus\",\"kind\":\"enum\",\"name\":\"status\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"location\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"amount\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"currency\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"AdvisorType\",\"kind\":\"enum\",\"name\":\"advisorType\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"organization\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"email\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"phone\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"feeSharingAgreement\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"feeSharingTerms\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"PartnerAgreementStatus\",\"kind\":\"enum\",\"name\":\"partnerAgreementStatus\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"internalOnly\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"feedbackNotes\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"ActorSource\",\"kind\":\"enum\",\"name\":\"createdSource\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true},{\"type\":\"Person\",\"kind\":\"object\",\"name\":\"contacts\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"PartnerToPerson\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Mandate\",\"kind\":\"object\",\"name\":\"referredMandates\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"PartnerReferral\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Transaction\",\"kind\":\"object\",\"name\":\"referredTransactions\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"PartnerTransactionReferral\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"StageChange\",\"kind\":\"object\",\"name\":\"stageChanges\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"PartnerToStageChange\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"Document\",\"kind\":\"object\",\"name\":\"documents\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DocumentToPartner\",\"relationFromFields\":[],\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"Activity\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"InteractionType\",\"kind\":\"enum\",\"name\":\"type\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"subject\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"body\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"occurredAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"ActorSource\",\"kind\":\"enum\",\"name\":\"createdSource\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"CommChannel\",\"kind\":\"enum\",\"name\":\"channel\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"CommDirection\",\"kind\":\"enum\",\"name\":\"direction\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"engagementId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Engagement\",\"kind\":\"object\",\"name\":\"engagement\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ActivityToEngagement\",\"relationFromFields\":[\"engagementId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"transactionId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Transaction\",\"kind\":\"object\",\"name\":\"transaction\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ActivityToTransaction\",\"relationFromFields\":[\"transactionId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"investorId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Investor\",\"kind\":\"object\",\"name\":\"investor\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ActivityToInvestor\",\"relationFromFields\":[\"investorId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"mandateId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Mandate\",\"kind\":\"object\",\"name\":\"mandate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ActivityToMandate\",\"relationFromFields\":[\"mandateId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"clientId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Client\",\"kind\":\"object\",\"name\":\"client\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ActivityToClient\",\"relationFromFields\":[\"clientId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"createdById\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"createdBy\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ActivityCreatedBy\",\"relationFromFields\":[\"createdById\"],\"isUpdatedAt\":false},{\"type\":\"Task\",\"kind\":\"object\",\"name\":\"tasks\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ActivityTasks\",\"relationFromFields\":[],\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"Task\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"title\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"TaskStatus\",\"kind\":\"enum\",\"name\":\"status\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"dueAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"body\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true},{\"type\":\"TaskSource\",\"kind\":\"enum\",\"name\":\"source\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Boolean\",\"kind\":\"scalar\",\"name\":\"escalated\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"assigneeId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"assignee\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"TaskAssignee\",\"relationFromFields\":[\"assigneeId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"mandateId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Mandate\",\"kind\":\"object\",\"name\":\"mandate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"MandateToTask\",\"relationFromFields\":[\"mandateId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"transactionId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Transaction\",\"kind\":\"object\",\"name\":\"transaction\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"TaskToTransaction\",\"relationFromFields\":[\"transactionId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"investorId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Investor\",\"kind\":\"object\",\"name\":\"investor\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"InvestorToTask\",\"relationFromFields\":[\"investorId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"clientId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Client\",\"kind\":\"object\",\"name\":\"client\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ClientToTask\",\"relationFromFields\":[\"clientId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"assistantId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"assistant\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"TaskAssistant\",\"relationFromFields\":[\"assistantId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"activityId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Activity\",\"kind\":\"object\",\"name\":\"activity\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ActivityTasks\",\"relationFromFields\":[\"activityId\"],\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"ServiceProvider\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"ServiceProviderType\",\"kind\":\"enum\",\"name\":\"type\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"contactPerson\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"email\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"phone\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"profile\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Decimal\",\"kind\":\"scalar\",\"name\":\"fee\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"currency\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"status\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"ActorSource\",\"kind\":\"enum\",\"name\":\"createdSource\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true},{\"type\":\"Transaction\",\"kind\":\"object\",\"name\":\"engagedOn\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"TransactionServiceProviders\",\"relationFromFields\":[],\"isUpdatedAt\":false},{\"type\":\"DueDiligenceTrack\",\"kind\":\"object\",\"name\":\"ddTracks\",\"isRequired\":true,\"isList\":true,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DDTrackProvider\",\"relationFromFields\":[],\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"Document\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DocumentType\",\"kind\":\"enum\",\"name\":\"type\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"version\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DocumentAccessLevel\",\"kind\":\"enum\",\"name\":\"accessLevel\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DocumentStatus\",\"kind\":\"enum\",\"name\":\"status\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"fileUrl\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"uploadedById\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"uploadedBy\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DocumentUploadedBy\",\"relationFromFields\":[\"uploadedById\"],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"uploadedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"reviewerId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"reviewer\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DocumentReviewer\",\"relationFromFields\":[\"reviewerId\"],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"reviewedAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"approverId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"approver\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DocumentApprover\",\"relationFromFields\":[\"approverId\"],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"approvedAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"clientReviewedAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"transactionId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Transaction\",\"kind\":\"object\",\"name\":\"transaction\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DocumentToTransaction\",\"relationFromFields\":[\"transactionId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"clientId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Client\",\"kind\":\"object\",\"name\":\"client\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ClientToDocument\",\"relationFromFields\":[\"clientId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"investorId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Investor\",\"kind\":\"object\",\"name\":\"investor\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DocumentToInvestor\",\"relationFromFields\":[\"investorId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"mandateId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Mandate\",\"kind\":\"object\",\"name\":\"mandate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DocumentToMandate\",\"relationFromFields\":[\"mandateId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"partnerId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Partner\",\"kind\":\"object\",\"name\":\"partner\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"DocumentToPartner\",\"relationFromFields\":[\"partnerId\"],\"isUpdatedAt\":false},{\"type\":\"ActorSource\",\"kind\":\"enum\",\"name\":\"createdSource\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"StageChange\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"field\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"fromValue\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"toValue\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"changedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"changedById\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"changedBy\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"StageChangeActor\",\"relationFromFields\":[\"changedById\"],\"isUpdatedAt\":false},{\"type\":\"ActorSource\",\"kind\":\"enum\",\"name\":\"createdSource\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"mandateId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Mandate\",\"kind\":\"object\",\"name\":\"mandate\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"MandateToStageChange\",\"relationFromFields\":[\"mandateId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"transactionId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Transaction\",\"kind\":\"object\",\"name\":\"transaction\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"StageChangeToTransaction\",\"relationFromFields\":[\"transactionId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"engagementId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Engagement\",\"kind\":\"object\",\"name\":\"engagement\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"EngagementToStageChange\",\"relationFromFields\":[\"engagementId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"clientId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Client\",\"kind\":\"object\",\"name\":\"client\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"ClientToStageChange\",\"relationFromFields\":[\"clientId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"investorId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Investor\",\"kind\":\"object\",\"name\":\"investor\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"InvestorToStageChange\",\"relationFromFields\":[\"investorId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"partnerId\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Partner\",\"kind\":\"object\",\"name\":\"partner\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"PartnerToStageChange\",\"relationFromFields\":[\"partnerId\"],\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"SavedView\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"name\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"entity\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"Json\",\"kind\":\"scalar\",\"name\":\"config\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"createdById\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"createdBy\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"SavedViewCreatedBy\",\"relationFromFields\":[\"createdById\"],\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"updatedAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueIndexes\":[]},\"Notification\":{\"fields\":[{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"id\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":true,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"userId\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"User\",\"kind\":\"object\",\"name\":\"user\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"relationName\":\"NotificationToUser\",\"relationFromFields\":[\"userId\"],\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"kind\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"title\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"body\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"String\",\"kind\":\"scalar\",\"name\":\"href\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"readAt\",\"isRequired\":false,\"isList\":false,\"hasDefaultValue\":false,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false},{\"type\":\"DateTime\",\"kind\":\"scalar\",\"name\":\"createdAt\",\"isRequired\":true,\"isList\":false,\"hasDefaultValue\":true,\"isUnique\":false,\"isId\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueIndexes\":[]}}}}"); }