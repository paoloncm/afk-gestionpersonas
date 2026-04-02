/**
 * STARK UI COMPONENTS - La interfaz del HUD.
 * Estandariza los elementos visuales de la plataforma AFK.
 */
(function() {
    window.Stark = window.Stark || {};

    window.Stark.UI = {
        /**
         * Crea un badge de estado basado en el motor de cumplimiento.
         */
        createComplianceBadge(compliance) {
            if (!compliance) return '<span class="badge badge--muted">Desconocido</span>';
            
            const { status, label, color } = compliance;
            let badgeClass = 'badge--active'; // Por defecto
            
            if (status === 'BLOQUEADO') badgeClass = 'badge--danger';
            else if (status === 'EN RIESGO') badgeClass = 'badge--warning';
            
            return `<span class="badge ${badgeClass}">${label}</span>`;
        },

        /**
         * Crea un punto de estado (dot) animado.
         */
        createStatusDot(compliance) {
            if (!compliance) return '<div class="status-dot" style="opacity:0.2"></div>';
            
            const colorMap = {
                'BLOQUEADO': '#fb7185', // Red
                'EN RIESGO': '#fbbf24', // Yellow
                'HABILITADO': '#34d399'  // Green
            };
            
            const color = colorMap[compliance.status] || '#94a3b8';
            return `<div class="status-dot" style="background: ${color}; box-shadow: 0 0 10px ${color}"></div>`;
        },

        /**
         * Renderiza una fila de trabajador táctica para las tablas HUD.
         */
        createWorkerRow(worker, compliance) {
            const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.full_name)}&background=0b1120&color=67e8f9&bold=true`;
            const badge = this.createComplianceBadge(compliance);
            const dot = this.createStatusDot(compliance);

            const statusText = compliance?.status === 'BLOQUEADO' ? 'BLOQUEADO' : (compliance?.status === 'EN RIESGO' ? 'EN RIESGO' : 'HABILITADO');
            const statusClass = compliance?.status === 'BLOQUEADO' ? 'badge--danger' : (compliance?.status === 'EN RIESGO' ? 'badge--warning' : 'badge--active');

            return `
                <div class="t-row" data-id="${worker.id}">
                    <div style="width:40px; padding: 18px 14px;"><input type="checkbox" class="worker-checkbox" value="${worker.id}"></div>
                    <div class="emp t-col-name">
                        <img class="avatar" src="${avatar}" style="border: 1px solid rgba(103, 232, 249, 0.2);">
                        <div class="emp__info">
                            <div class="emp__name" style="color:var(--text); font-weight:700;">${worker.full_name}</div>
                            <div style="font-size:10px; color:var(--muted)">${worker.rut || 'Sin RUT'}</div>
                        </div>
                    </div>
                    <div class="t-col-faena" style="font-size: 13px; color: rgba(255,255,255,0.8)">
                        ${worker.faena || 'Sin asignar'}
                        <div style="font-size:10px; color:var(--muted)">${worker.company_name || 'Sin empresa'}</div>
                    </div>
                    <div class="t-col-status">
                        <span class="badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="t-col-risk" style="display:flex; align-items:center; gap:8px;">
                        ${dot}
                        <span style="font-size:11px; color:var(--muted)">${compliance?.label || 'Analizando...'}</span>
                    </div>
                    <div class="t-col-exp" style="font-family: monospace; font-size: 11px; color: var(--accent)">
                        ${compliance?.stats?.upcoming > 0 ? `${compliance.stats.upcoming} alertas` : 'Sin novedades'}
                    </div>
                    <div class="t-col-actions" style="display:flex; justify-content: flex-end; gap:8px;">
                        <button class="btn btn--mini" onclick="viewWorkerDetails('${worker.id}')">Ficha</button>
                    </div>
                </div>
            `;
        },

        /**
         * Renderiza una fila de documento/alerta para el Radar de Cumplimiento.
         */
        createDocumentRow(item, compliance) {
            const workerName = item.workers?.full_name || 'Desconocido';
            const docName = item.exam_type ? `${item.credential_name} (${item.exam_type})` : (item.credential_name || 'Sin nombre');
            const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(workerName)}&background=0b1120&color=67e8f9&bold=true`;
            
            // Usamos la lógica de visualización de documentos
            const { badgeClass, statusLabel, sevClass, sevLabel, dateStr } = compliance;

            return `
                <div class="t-row">
                    <div class="emp t-col-name">
                        <img class="avatar" src="${avatar}" style="border: 1px solid rgba(103, 232, 249, 0.2);">
                        <div class="emp__info">
                            <div class="emp__name" style="color:var(--text); font-weight:700;">${workerName}</div>
                            <div style="font-size:10px; color:var(--muted)">${item.workers?.rut || 'Sin RUT'}</div>
                        </div>
                    </div>
                    <div class="t-col-doc" style="font-weight: 600; color: rgba(255,255,255,0.9)">${docName}</div>
                    <div class="t-col-date" style="font-family: monospace; font-size: 13px;">${dateStr}</div>
                    <div class="t-col-status"><span class="badge ${badgeClass}">${statusLabel}</span></div>
                    <div class="t-col-sev"><span class="sev ${sevClass}">${sevLabel}</span></div>
                </div>
            `;
        }
    };

    console.log("[Stark UI] Componentes HUD inicializados.");
})();
