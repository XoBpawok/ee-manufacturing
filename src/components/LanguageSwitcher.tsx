import { Dropdown, Button } from "antd";
import { GlobalOutlined, DownOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "../i18n/languages";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  return (
    <Dropdown
      trigger={["click"]}
      menu={{
        selectable: true,
        selectedKeys: [current.code],
        items: LANGUAGES.map((l) => ({
          key: l.code,
          label: `${l.flag} ${l.nativeName}`,
        })),
        onClick: ({ key }) => {
          void i18n.changeLanguage(key);
        },
      }}
    >
      <Button type="text" style={{ color: "#fff" }}>
        <GlobalOutlined />
        <span style={{ marginInline: 6 }}>
          {current.flag} {current.nativeName}
        </span>
        <DownOutlined style={{ fontSize: 10 }} />
      </Button>
    </Dropdown>
  );
}
