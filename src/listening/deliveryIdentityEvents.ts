import { listen } from "@tauri-apps/api/event";

const DELIVERY_IDENTITY_CHANGED_EVENT = "project-delivery-identity-changed";

export interface ProjectDeliveryIdentityChangedEvent {
  clientId: string;
  projectId: string;
}

export const startDeliveryIdentityChangeCapture = (
  onChange: (event: ProjectDeliveryIdentityChangedEvent) => void,
) => listen<ProjectDeliveryIdentityChangedEvent>(
  DELIVERY_IDENTITY_CHANGED_EVENT,
  (message) => onChange(message.payload),
);
