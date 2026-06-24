import { mondayGraphql, normalizeMondayItems, type MondayBoardItemsResponse } from "@/lib/monday";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const boardId = url.searchParams.get("boardId")?.trim();

  if (!boardId) {
    return Response.json(
      { error: { code: "missing_board_id", message: "Parametre boardId requis." } },
      { status: 400, headers: NO_STORE },
    );
  }

  const result = await mondayGraphql<MondayBoardItemsResponse>(
    `
      query MondayPilotTasks($boardIds: [ID!]!) {
        boards(ids: $boardIds) {
          id
          name
          items_page(limit: 100) {
            items {
              id
              name
              group {
                id
                title
              }
              column_values {
                id
                text
                value
              }
            }
          }
        }
      }
    `,
    { boardIds: [boardId] },
  );

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 503, headers: NO_STORE });
  }

  return Response.json(
    {
      boardId,
      tasks: normalizeMondayItems(result.data),
    },
    { headers: NO_STORE },
  );
}
