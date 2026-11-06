import { adventureSummaries } from '../../../lib/adventure-templates';

export function GET() {
  return Response.json(adventureSummaries);
}
