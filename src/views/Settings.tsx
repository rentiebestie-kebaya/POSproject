"use client";

import { Store, Users } from "lucide-react";
import { Card, PageHeader } from "../components/Ui";
import { useTenant } from "../data/store";
import { ROLE_LABEL } from "../data/mock";

export default function Settings() {
  const { tenant, team } = useTenant();

  return (
    <>
      <PageHeader title="Settings" subtitle="Shop profile and team access." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Store size={15} className="text-ink-3" /> Shop profile
          </h2>
          <dl className="space-y-3 text-sm">
            {[
              ["Shop name", tenant.name],
              ["Booking page", tenant.subdomain],
              ["Outlet", tenant.outlet],
              ["WhatsApp Business", tenant.whatsapp],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-hairline pb-3 last:border-0 last:pb-0">
                <dt className="text-ink-2">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Users size={15} className="text-ink-3" /> Team & roles
          </h2>
          <ul className="space-y-3">
            {team.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 border-b border-hairline pb-3 text-sm last:border-0 last:pb-0">
                <div className="font-medium">{s.name}</div>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                  {ROLE_LABEL[s.role]}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

    </>
  );
}