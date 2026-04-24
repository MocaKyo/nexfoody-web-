import React, { createContext, useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { TenantConfig, TenantContextValue } from "../types/tenant";

const TenantContext = createContext<TenantContextValue>({
  tenantId: null,
  tenantConfig: null,
  isLoading: true,
  isValidTenant: false,
});

export const useTenant = () => useContext(TenantContext);

export function TenantProvider({ children, slug: slugProp }: { children: React.ReactNode; slug?: string }) {
  const params = useParams<{ slug: string }>();
  const slug = slugProp ?? params.slug;
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log("[TenantProvider] slug from useParams:", slug);
    if (!slug) {
      console.log("[TenantProvider] no slug, skipping");
      setIsLoading(false);
      return;
    }

    const resolve = async () => {
      try {
        console.log("[TenantProvider] fetching lojas/", slug);
        const lojaSnap = await getDoc(doc(db, "lojas", slug));
        console.log("[TenantProvider] lojaSnap exists:", lojaSnap.exists(), lojaSnap.data());

        if (!lojaSnap.exists()) {
          console.log("[TenantProvider] loja not found");
          setIsLoading(false);
          return;
        }

        const resolvedTenantId = lojaSnap.data().tenantId || slug;
        console.log("[TenantProvider] resolvedTenantId:", resolvedTenantId);

        const configSnap = await getDoc(doc(db, `tenants/${resolvedTenantId}/config/loja`));
        console.log("[TenantProvider] configSnap exists:", configSnap.exists());

        if (configSnap.exists()) {
          setTenantConfig({ tenantId: resolvedTenantId, ...configSnap.data() } as TenantConfig);
          console.log("[TenantProvider] config set");
        }
        setTenantId(resolvedTenantId);
      } catch (e) {
        console.warn("[TenantProvider] erro:", e);
      }
      setIsLoading(false);
    };

    resolve();
  }, [slug]);

  return (
    <TenantContext.Provider
      value={{
        tenantId,
        tenantConfig,
        isLoading,
        isValidTenant: !!tenantId && !!tenantConfig?.ativo,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}
