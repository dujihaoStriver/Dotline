"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LoadingState } from "@/components/LoadingState";
import { TimelineTree } from "@/components/TimelineTree";
import { getYearKey } from "@/lib/dates";
import { useClientNow } from "@/lib/use-client-now";

export default function TreeHomePage() {
  const now = useClientNow();
  const [yearKey, setYearKey] = useState<string | null>(null);

  useEffect(() => {
    if (now && !yearKey) setYearKey(getYearKey(now));
  }, [now, yearKey]);

  if (!yearKey) return <LoadingState title="脉络" />;

  return (
    <AppShell
      wide
      title="脉络"
      subtitle="把一年铺成一条线：快记、排序、复盘"
    >
      <TimelineTree initialYearKey={yearKey} />
    </AppShell>
  );
}
