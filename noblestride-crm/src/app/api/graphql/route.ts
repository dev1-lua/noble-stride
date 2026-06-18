import { createYoga } from "graphql-yoga";
import { schema } from "@/graphql/schema";
import { createContext } from "@/graphql/context";

export const runtime = "nodejs";

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  context: ({ request }) => createContext(request),
  fetchAPI: { Response },
});

export { yoga as GET, yoga as POST };
