import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type DialogVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertOptions {
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  variant?: DialogVariant;
}

export interface ConfirmOptions extends AlertOptions {
  cancelLabel?: string;
  destructive?: boolean;
}

export interface PromptOptions extends ConfirmOptions {
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
}

interface DialogApi {
  alert: (options: string | AlertOptions) => Promise<void>;
  confirm: (options: string | ConfirmOptions) => Promise<boolean>;
  prompt: (options: string | PromptOptions) => Promise<string | null>;
}

type DialogState =
  | { id: number; kind: 'alert'; options: AlertOptions; resolve: () => void }
  | { id: number; kind: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { id: number; kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void };

const DialogContext = createContext<DialogApi | null>(null);

function normalizeAlert(options: string | AlertOptions): AlertOptions {
  return typeof options === 'string' ? { message: options } : options;
}

function normalizeConfirm(options: string | ConfirmOptions): ConfirmOptions {
  return typeof options === 'string' ? { message: options } : options;
}

function normalizePrompt(options: string | PromptOptions): PromptOptions {
  return typeof options === 'string' ? { message: options } : options;
}

const icons: Record<DialogVariant, { symbol: string; className: string }> = {
  info: { symbol: 'i', className: 'bg-blue-100 text-blue-600' },
  success: { symbol: '✓', className: 'bg-green-100 text-green-600' },
  warning: { symbol: '!', className: 'bg-yellow-100 text-yellow-700' },
  danger: { symbol: '!', className: 'bg-red-100 text-red-600' },
};

export const useAppDialog = (): DialogApi => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useAppDialog debe usarse dentro de AppDialogProvider');
  }
  return context;
};

interface DialogViewProps {
  dialog: DialogState;
  onCancel: () => void;
  onConfirm: (value?: string) => void;
}

const DialogView: React.FC<DialogViewProps> = ({ dialog, onCancel, onConfirm }) => {
  const { kind, options } = dialog;
  const promptOptions = kind === 'prompt' ? (options as PromptOptions) : null;
  const destructive = kind !== 'alert' && (options as ConfirmOptions).destructive === true;
  const variant: DialogVariant =
    options.variant ?? (destructive ? 'danger' : kind === 'alert' ? 'info' : 'warning');
  const icon = icons[variant];
  const [text, setText] = useState(promptOptions?.defaultValue ?? '');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const canConfirm = !promptOptions?.required || text.trim().length > 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (input instanceof HTMLInputElement) input.select();
  }, []);

  const title =
    options.title ??
    (variant === 'danger' ? 'Confirmar acción' : kind === 'alert' ? 'Aviso' : 'Confirmar');

  const handleSubmit = () => {
    if (canConfirm) onConfirm(promptOptions ? text : undefined);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="text-center">
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl font-bold ${icon.className}`}
          >
            {icon.symbol}
          </div>
          <h3 id="app-dialog-title" className="text-xl font-bold text-gray-800">
            {title}
          </h3>
          <div className="mt-2 text-sm leading-relaxed text-gray-600">{options.message}</div>
        </div>

        {promptOptions && (
          <div className="mt-4 text-left">
            {promptOptions.label && (
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {promptOptions.label}
              </label>
            )}
            {promptOptions.multiline ? (
              <textarea
                ref={(node) => {
                  inputRef.current = node;
                }}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={promptOptions.placeholder}
                rows={3}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-sanse-blue focus:outline-none"
              />
            ) : (
              <input
                ref={(node) => {
                  inputRef.current = node;
                }}
                type="text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={promptOptions.placeholder}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-sanse-blue focus:outline-none"
              />
            )}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          {kind !== 'alert' && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg bg-gray-300 py-2 text-gray-700 hover:bg-gray-400"
            >
              {options.cancelLabel ?? 'Cancelar'}
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canConfirm}
            className={`flex-1 rounded-lg py-2 text-white disabled:opacity-50 ${
              destructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-sanse-blue hover:bg-blue-700'
            }`}
          >
            {options.confirmLabel ?? (kind === 'alert' ? 'Aceptar' : 'Confirmar')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const AppDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const dialogRef = useRef<DialogState | null>(null);
  const idRef = useRef(0);

  const openDialog = useCallback((next: DialogState) => {
    dialogRef.current = next;
    setDialog(next);
  }, []);

  const settle = useCallback((value?: string | boolean | null) => {
    const current = dialogRef.current;
    if (!current) return;
    dialogRef.current = null;
    setDialog(null);
    if (current.kind === 'alert') {
      current.resolve();
      return;
    }
    if (current.kind === 'confirm') {
      current.resolve(value === true);
      return;
    }
    current.resolve(typeof value === 'string' ? value : null);
  }, []);

  const alert = useCallback(
    (options: string | AlertOptions) =>
      new Promise<void>((resolve) => {
        openDialog({
          id: ++idRef.current,
          kind: 'alert',
          options: normalizeAlert(options),
          resolve,
        });
      }),
    [openDialog],
  );

  const confirm = useCallback(
    (options: string | ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        openDialog({
          id: ++idRef.current,
          kind: 'confirm',
          options: normalizeConfirm(options),
          resolve,
        });
      }),
    [openDialog],
  );

  const prompt = useCallback(
    (options: string | PromptOptions) =>
      new Promise<string | null>((resolve) => {
        openDialog({
          id: ++idRef.current,
          kind: 'prompt',
          options: normalizePrompt(options),
          resolve,
        });
      }),
    [openDialog],
  );

  const api = useMemo(() => ({ alert, confirm, prompt }), [alert, confirm, prompt]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog && (
        <DialogView
          key={dialog.id}
          dialog={dialog}
          onCancel={() => settle(null)}
          onConfirm={(value) => settle(dialog.kind === 'confirm' ? true : value)}
        />
      )}
    </DialogContext.Provider>
  );
};
