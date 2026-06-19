import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Divider,
  Empty,
  FloatButton,
  Form,
  Input,
  List,
  Modal,
  Spin,
  Typography,
  message as antMessage,
} from "antd";
import { CommentOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import {
  fetchFeedback,
  feedbackConfigured,
  submitFeedback,
  type FeedbackEntry,
} from "../api/feedback";

const { Text, Paragraph } = Typography;

interface FormValues {
  name?: string;
  message: string;
}

export function FeedbackButton() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<FormValues>();

  // Feedback needs Supabase; without it there is nowhere to store or read entries.
  const configured = feedbackConfigured();

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    fetchFeedback()
      .then(setEntries)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open && configured) load();
  }, [open, configured, load]);

  const onFinish = useCallback(
    (values: FormValues) => {
      setSubmitting(true);
      submitFeedback(values.name ?? "", values.message)
        .then((entry) => {
          setEntries((prev) => [entry, ...prev]);
          form.resetFields();
          void antMessage.success(t("feedback.success"));
        })
        .catch(() => {
          void antMessage.error(t("feedback.error"));
        })
        .finally(() => setSubmitting(false));
    },
    [form, t],
  );

  if (!configured) return null;

  return (
    <>
      <FloatButton
        icon={<CommentOutlined />}
        type="primary"
        tooltip={t("feedback.button")}
        onClick={() => setOpen(true)}
      />
      <Modal
        title={t("feedback.title")}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="name" label={t("feedback.nameLabel")}>
            <Input placeholder={t("feedback.namePlaceholder")} maxLength={60} allowClear />
          </Form.Item>
          <Form.Item
            name="message"
            label={t("feedback.messageLabel")}
            rules={[{ required: true, whitespace: true, message: t("feedback.messagePlaceholder") }]}
          >
            <Input.TextArea
              placeholder={t("feedback.messagePlaceholder")}
              autoSize={{ minRows: 3, maxRows: 6 }}
              maxLength={1000}
              showCount
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={submitting} block>
              {submitting ? t("feedback.sending") : t("feedback.submit")}
            </Button>
          </Form.Item>
        </Form>

        <Divider style={{ margin: "16px 0" }}>{t("feedback.listTitle")}</Divider>

        {loading ? (
          <div style={{ textAlign: "center", padding: 24 }}>
            <Spin />
          </div>
        ) : loadError ? (
          <Alert type="error" showIcon message={t("feedback.loadError")} />
        ) : entries.length === 0 ? (
          <Empty description={t("feedback.empty")} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            size="small"
            dataSource={entries}
            style={{ maxHeight: 320, overflowY: "auto" }}
            renderItem={(e) => (
              <List.Item style={{ display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <Text strong>{e.name?.trim() || t("feedback.anon")}</Text>
                  <Text type="secondary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {new Date(e.createdAt).toLocaleDateString(i18n.language, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </div>
                <Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{e.message}</Paragraph>
              </List.Item>
            )}
          />
        )}
      </Modal>
    </>
  );
}
