import { forwardRef, useImperativeHandle } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { addNote, getNotifySettings, isQuiet, osNotify, type NoteKind } from '@/lib/notifications';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning';
export type ToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
export interface ToastAction { label: string; onClick: () => void; variant?: 'default' | 'outline' | 'ghost' }
export interface ToasterProps {
  title?: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  position?: ToastPosition;
  actions?: ToastAction;
  onDismiss?: () => void;
  highlightTitle?: boolean;
  /** Reuse a stable ID to update a pending notification instead of stacking copies. */
  id?: string;
  /** Which group it belongs to in the notification centre. */
  kind?: NoteKind;
  /** Also show a system notification when the app is in the background. Timer blocks (id "timer-status") do by default. */
  os?: boolean;
  /** False keeps a quick confirmation out of the notification centre. */
  record?: boolean;
}
export interface ToasterRef { show: (props: ToasterProps) => void }

const variantIcons: Record<ToastVariant, LucideIcon> = {
  default: Info, success: CheckCircle2, error: AlertCircle, warning: AlertTriangle,
};
const variantStyles: Record<ToastVariant, string> = {
  default: 'border-line bg-canvas',
  success: 'border-ink bg-canvas border-l-[3px]',
  error: 'border-ink bg-surface border-2',
  warning: 'border-muted bg-surface border-l-[3px]',
};

function ToastCard({ toastId, props }: { toastId: string | number; props: ToasterProps }) {
  const reduce = useReducedMotion();
  const variant = props.variant ?? 'default';
  const Icon = variantIcons[variant];
  return <motion.div
    role={variant === 'error' ? 'alert' : 'status'}
    initial={reduce ? false : { opacity: 0, y: 16, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={reduce ? undefined : { opacity: 0, y: 12, scale: 0.97 }}
    transition={{ duration: reduce ? 0 : 0.24, ease: 'easeOut' }}
    className={cn('flex w-[min(360px,calc(100vw-32px))] items-start gap-3 rounded-xl border p-3.5 text-ink shadow-float', variantStyles[variant])}
  >
    <Icon size={17} strokeWidth={1.9} aria-hidden="true" className={cn('mt-0.5 shrink-0', variant === 'default' ? 'text-muted' : 'text-ink')} />
    <div className="min-w-0 flex-1">
      {props.title && <h3 className={cn('text-[12px] font-semibold leading-snug', props.highlightTitle && 'underline decoration-line underline-offset-4')}>{props.title}</h3>}
      <p className={cn('break-words text-[11px] leading-[1.6] text-muted', props.title && 'mt-0.5')}>{props.message}</p>
    </div>
    <div className="flex shrink-0 items-center gap-1">
      {props.actions?.label && <Button size="sm" variant={props.actions.variant ?? 'outline'} className="h-8 px-2 text-[10px]" onClick={() => { props.actions?.onClick(); sonnerToast.dismiss(toastId); }}>{props.actions.label}</Button>}
      <button type="button" onClick={() => { sonnerToast.dismiss(toastId); props.onDismiss?.(); }} aria-label="Dismiss notification" className="rounded-lg p-1.5 text-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline focus-visible:outline-2"><X size={14} aria-hidden="true" /></button>
    </div>
  </motion.div>;
}

/** May be called from any UI action; mounts only ephemeral, public status text. */
export function notify(props: ToasterProps): void {
  const awayFromControls: ToastPosition = 'bottom-right';
  const { duration = 4200, position = awayFromControls, id } = props;
  // Titled messages and anything that is not plain feedback are kept in the notification centre.
  if (props.record !== false && (props.title || (props.variant && props.variant !== 'default'))) {
    addNote({ kind: props.kind ?? (props.variant === 'error' || props.variant === 'warning' ? 'system' : 'info'), title: props.title ?? '', message: props.message, key: id });
    if (props.os ?? id === 'timer-status') osNotify(props.title || 'Study with Sarang', props.message);
  }
  if (props.variant !== 'error' && isQuiet(getNotifySettings().quiet)) return;
  sonnerToast.custom((toastId) => <ToastCard toastId={toastId} props={props} />, { duration, position, id });
}

/** Mount exactly once at the app root. The forwarded ref also supports demos. */
const Toaster = forwardRef<ToasterRef, { defaultPosition?: ToastPosition }>(
  ({ defaultPosition = 'bottom-right' }, ref) => {
    useImperativeHandle(ref, () => ({ show: (props) => notify({ position: defaultPosition, ...props }) }), [defaultPosition]);
    return <SonnerToaster position={defaultPosition} visibleToasts={3} toastOptions={{ unstyled: true }} />;
  },
);
Toaster.displayName = 'Toaster';
export default Toaster;
