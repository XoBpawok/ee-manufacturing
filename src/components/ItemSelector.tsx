import { Select } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { GameData } from "../api/types";

interface Props {
  data: GameData;
  value: number;
  onChange: (id: number) => void;
}

/** Searchable picker of craftable items (only those that have a blueprint). */
export function ItemSelector({ data, value, onChange }: Props) {
  const { t } = useTranslation();
  const options = useMemo(() => {
    return data.craftables.map((it) => ({
      value: it.id,
      label: `${it.name} — ${it.groupName}`,
    }));
  }, [data]);

  return (
    <Select
      showSearch
      style={{ minWidth: 360 }}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={t("selector.placeholder")}
      filterOption={(input, option) =>
        (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
      }
    />
  );
}
