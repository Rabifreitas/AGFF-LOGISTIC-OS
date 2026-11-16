"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/modules/iam/action-result";
import { formId, runAction, runFormAction } from "@/modules/iam/form-action";
import { auctionSchema, bidSchema, providerProfileSchema, providerReviewSchema } from "./auction-schemas";
import * as svc from "./services/auction.service";

export async function createAuctionAction(_: ActionState, f: FormData): Promise<ActionState> {
  let id: string | null = null;
  const res = await runFormAction(
    f,
    auctionSchema,
    async (ctx, d) => {
      id = (await svc.createAuction(ctx, d)).id;
    },
    "/app/auctions",
  );
  if (res.ok && id) redirect(`/app/auctions/${id}`);
  return res;
}

export async function cancelAuctionAction(_: ActionState, f: FormData) {
  const id = formId(f);
  return runAction((ctx) => svc.cancelAuction(ctx, id), `/app/auctions/${id}`);
}

export async function awardAuctionAction(_: ActionState, f: FormData) {
  const id = formId(f);
  return runAction((ctx) => svc.awardAuction(ctx, id, formId(f, "bidId")), `/app/auctions/${id}`);
}

export async function placeBidAction(_: ActionState, f: FormData) {
  const id = formId(f);
  return runFormAction(f, bidSchema, (ctx, d) => svc.placeBid(ctx, id, d), `/app/marketplace/${id}`);
}

export async function withdrawBidAction(_: ActionState, f: FormData) {
  const id = formId(f);
  return runAction((ctx) => svc.withdrawBid(ctx, id), `/app/marketplace/${id}`);
}

export async function saveProviderProfileAction(_: ActionState, f: FormData) {
  return runFormAction(f, providerProfileSchema, svc.saveProviderProfile, "/app/organization/provider");
}

export async function submitProviderProfileAction() {
  return runAction((ctx) => svc.submitProviderProfile(ctx), "/app/organization/provider");
}

export async function reviewProviderAction(_: ActionState, f: FormData) {
  const id = formId(f);
  return runFormAction(f, providerReviewSchema, (ctx, d) => svc.reviewProviderProfile(ctx, id, d), "/admin/providers");
}
