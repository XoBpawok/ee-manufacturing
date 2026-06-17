import { Button, Empty, InputNumber, Slider, Space, Tooltip, Typography } from "antd";
import type { GameData } from "../api/types";
import { MAX_SKILL_LEVEL } from "../domain/skills";

const { Text } = Typography;

interface Props {
  data: GameData;
  relevantSkills: string[];
  skillLevels: Map<string, number>;
  onChange: (name: string, level: number) => void;
  onReset: () => void;
  materialEfficiency: number | null;
  onMaterialEfficiencyChange: (value: number | null) => void;
  capComponentCostReduction: number;
  onCapComponentCostReductionChange: (pct: number) => void;
}

/** Слайдери рівнів (0..5) для скілів + ручне перевизначення ефективності матеріалів. */
export function SkillsPanel({
  data,
  relevantSkills,
  skillLevels,
  onChange,
  onReset,
  materialEfficiency,
  onMaterialEfficiencyChange,
  capComponentCostReduction,
  onCapComponentCostReductionChange,
}: Props) {
  const meActive = materialEfficiency != null;

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="middle">
      <div>
        <Space style={{ justifyContent: "space-between", width: "100%" }}>
          <Text>
            Ефективність матеріалів{" "}
            <Tooltip title="Значення блюпрінта = 100%. Задане число перекриває скіли для КІЛЬКОСТІ матеріалів (50 = вдвічі менше, 150 = в 1.5× більше). Час job далі рахується за скілами.">
              <Text type="secondary" style={{ cursor: "help" }}>
                ⓘ
              </Text>
            </Tooltip>
          </Text>
          {meActive && (
            <Button size="small" type="text" onClick={() => onMaterialEfficiencyChange(null)}>
              За скілами ✕
            </Button>
          )}
        </Space>
        <InputNumber
          style={{ width: "100%", marginTop: 4 }}
          min={50}
          max={150}
          step={1}
          value={materialEfficiency}
          placeholder="За скілами (вимкнено)"
          addonAfter="%"
          onChange={(v) => onMaterialEfficiencyChange(v ?? null)}
        />
      </div>

      <div>
        <Text>
          Знижка вартості job для Capital Components{" "}
          <Tooltip title="Зниження ISK-вартості виробництва капітальних компонентів (Capital Construction Components) — напр. від скілів Production Optimization. 0% = без знижки.">
            <Text type="secondary" style={{ cursor: "help" }}>
              ⓘ
            </Text>
          </Tooltip>
        </Text>
        <InputNumber
          style={{ width: "100%", marginTop: 4 }}
          min={0}
          max={100}
          step={1}
          value={capComponentCostReduction}
          addonAfter="%"
          onChange={(v) => onCapComponentCostReductionChange(v ?? 0)}
        />
      </div>

      {relevantSkills.length === 0 ? (
        <Empty description="Немає скілів для цього предмета" />
      ) : (
        <>
          <div style={{ textAlign: "right" }}>
            <Button size="small" onClick={onReset}>
              Усі на макс (5)
            </Button>
          </div>
          {relevantSkills.map((name) => {
            const skill = data.skillByName.get(name);
            const level = skillLevels.get(name) ?? MAX_SKILL_LEVEL;
            const eff = skill && level > 0 ? skill.efficiency[level - 1] : 0;
            return (
              <div key={name} style={{ opacity: meActive ? 0.5 : 1 }}>
                <Space style={{ justifyContent: "space-between", width: "100%" }}>
                  <Text>{name}</Text>
                  <Text type="secondary">
                    рів. {level} · −{eff}% матеріалів
                  </Text>
                </Space>
                <Slider
                  min={0}
                  max={MAX_SKILL_LEVEL}
                  value={level}
                  marks={{ 0: "0", 5: "5" }}
                  onChange={(v) => onChange(name, v)}
                />
              </div>
            );
          })}
        </>
      )}
    </Space>
  );
}
