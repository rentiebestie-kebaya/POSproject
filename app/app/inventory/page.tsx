import { Suspense } from "react";
import Inventory from "@/views/Inventory";

export default function InventoryPage() {
  return (
    <Suspense fallback={null}>
      <Inventory />
    </Suspense>
  );
}
