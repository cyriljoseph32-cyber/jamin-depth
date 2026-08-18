import { timingSafeEqual } from "node:crypto";
import { createRuntime } from "@/agents/runtime";
import { isJob, runJob } from "@/agents/schedule";
import { isCommandJob, runCommandJob } from "@/command/jobs";
import { createCommandRuntime } from "@/command/runtime";

/**
 * Scheduled jobs, driven by Vercel Cron (see `vercel.json`).
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. Without that check the
 * endpoints are public triggers: anyone could fire follow-ups in a loop and
 * burn through the two-nudge cap on every lead in the CRM.
 *
 * Two catalogues answer here: the dive system's jobs (`agents/schedule.ts`) and
 * COCO COMMAND's (`command/jobs.ts`). They stay separate so the dive system
 * keeps running with the chief-of-staff layer switched off.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  // No secret configured means the endpoint stays shut, not wide open.
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  if (!authorised(req)) return new Response("unauthorized", { status: 401 });

  const { job } = await params;

  if (isCommandJob(job)) {
    const command = createCommandRuntime();
    try {
      return Response.json(await runCommandJob(job, command, new Date().toISOString()));
    } catch (err) {
      console.error(`cron ${job} failed:`, err);
      return Response.json({ error: "job failed", job }, { status: 500 });
    }
  }

  if (!isJob(job)) return Response.json({ error: `unknown job: ${job}` }, { status: 404 });

  const rt = createRuntime();
  try {
    const result = await runJob(job, {
      ports: rt.ports,
      queue: rt.queue,
      log: rt.log,
      now: new Date().toISOString(),
    });
    if (rt.persistAudit) await rt.persistAudit(rt.log.entries());
    return Response.json(result);
  } catch (err) {
    console.error(`cron ${job} failed:`, err);
    return Response.json({ error: `job failed`, job }, { status: 500 });
  }
}
