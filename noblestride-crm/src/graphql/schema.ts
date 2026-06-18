// GraphQL schema assembly.
// Side-effect imports register all fields onto the builder.

import "./types";
import "./queries";
import "./mutations";
import { builder } from "./builder";

export const schema = builder.toSchema();
