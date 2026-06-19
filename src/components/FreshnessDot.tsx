import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import { freshnessColor, freshnessDays } from "../domain/freshness";

export function FreshnessDot({ updatedAt }: { updatedAt?: string }) {
  const { t } = useTranslation();
  if (!updatedAt) return null;
  const days = freshnessDays(updatedAt);
  const label =
    days <= 0
      ? t("freshness.today")
      : days === 1
        ? t("freshness.yesterday")
        : t("freshness.daysAgo", { count: days });
  return (
    <Tooltip title={label}>
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: freshnessColor(updatedAt),
          marginLeft: 6,
          verticalAlign: "middle",
        }}
      />
    </Tooltip>
  );
}
