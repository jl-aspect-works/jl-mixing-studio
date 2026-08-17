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
  if (!message) return null;
  return <section key={message} className={`notice ${warning ? "warning" : "success"}`} role="status"><strong>{title}</strong><span>{message}</span></section>;
}

export function AppNotices(props: AppNoticesProps) {
  return <>
    <Notice title="Selection changed" message={props.routeNotice} warning />
    <Notice title="Studio created" message={props.studioNotice} />
    <Notice title="Client created" message={props.clientNotice} />
    <Notice title="Project created" message={props.projectNotice} />
    <Notice title="Intake report updated" message={props.intakeNotice} />
    <Notice title="Revision created" message={props.revisionNotice} />
    <Notice title="Revision approved" message={props.approvalNotice} />
    <Notice title="Delivery created" message={props.deliveryNotice} />
  </>;
}
