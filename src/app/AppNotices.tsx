import { useEffect, useState } from "react";

export interface AppNoticesProps {
  routeNotice: string | null;
  studioNotice: string | null;
  clientNotice: string | null;
  projectNotice: string | null;
  intakeNotice: string | null;
  revisionNotice: string | null;
  approvalNotice: string | null;
  deliveryNotice: string | null;
}

function Notice({ title, message, warning = false }: { title: string; message: string | null; warning?: boolean }) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
    if (!message || warning) return;
    const timer = window.setTimeout(() => setVisible(false), 4000);
    return () => window.clearTimeout(timer);
  }, [message, warning]);

  if (!message || !visible) return null;
  return <section className={`notice ${warning ? "warning" : "success"}`} role="status"><strong>{title}</strong><span>{message}</span></section>;
}

export function AppNotices(props: AppNoticesProps) {
  const studioNoticeTitle = props.studioNotice?.toLocaleLowerCase().includes("created and verified")
    ? "Studio created"
    : "Studio updated";

  return <>
    <Notice title="Selection changed" message={props.routeNotice} warning />
    <Notice title={studioNoticeTitle} message={props.studioNotice} />
    <Notice title="Client created" message={props.clientNotice} />
    <Notice title="Project created" message={props.projectNotice} />
    <Notice title="Intake report updated" message={props.intakeNotice} />
    <Notice title="Revision created" message={props.revisionNotice} />
    <Notice title="Revision approved" message={props.approvalNotice} />
    <Notice title="Delivery created" message={props.deliveryNotice} />
  </>;
}
