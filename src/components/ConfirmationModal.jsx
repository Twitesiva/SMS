import React from 'react';

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirm Delete",
    message = "Are you sure you want to delete this item?",
    confirmText = "Delete",
    confirmButtonClass = "btn-danger",
    cancelText = "Cancel",
    isLoading = false
}) {
    if (!isOpen) return null;

    return (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header border-0 pb-0">
                        <h5 className="modal-title fw-bold">{title}</h5>
                        <button type="button" className="btn-close" onClick={onClose} aria-label="Close" disabled={isLoading}></button>
                    </div>
                    <div className="modal-body py-4">
                        <p className="mb-0 text-muted">{message}</p>
                    </div>
                    <div className="modal-footer border-0 pt-0">
                        <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={isLoading}>
                            {cancelText}
                        </button>
                        <button type="button" className={`btn ${confirmButtonClass}`} onClick={onConfirm} disabled={isLoading}>
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
