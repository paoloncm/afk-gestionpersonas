/**
 * AFK API CORE - El sistema nervioso de la plataforma Stark.
 * Centraliza todas las llamadas a Supabase y al Motor de Cumplimiento.
 */
(function() {
    window.AFK = window.AFK || {};

    window.AFK.api = {
        /**
         * Obtiene todos los trabajadores activos.
         */
        async getWorkers() {
            const { data, error } = await supabase
                .from('workers')
                .select('id, full_name, rut, cargo, faena, status')
                .order('full_name');
            
            if (error) throw error;
            return data;
        },

        /**
         * Obtiene todos los documentos/credenciales vigentes (is_latest).
         */
        async getCredentials() {
            const { data, error } = await supabase
                .from('worker_credentials')
                .select('*')
                .eq('is_latest', true);
            
            if (error) throw error;
            return data;
        },

        /**
         * Obtiene los exámenes médicos.
         */
        async getMedicalExams() {
            const { data, error } = await supabase
                .from('medical_exam_records')
                .select('*');
            
            if (error) throw error;
            return data;
        },

        /**
         * Evalúa el cumplimiento de MÚLTIPLES trabajadores en una sola llamada (High Performance).
         */
        async evaluateBulkCompliance(workers, documents) {
            try {
                const response = await fetch('/api/compliance/evaluate-bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ worker: workers, documents })
                });
                
                const result = await response.json();
                if (!result.ok) throw new Error(result.detail);
                
                return result.results;
            } catch (err) {
                console.error("[AFK API] Error en evaluación masiva:", err);
                return [];
            }
        },

        /**
         * Helper para obtener documentos de un trabajador específico por RUT.
         */
        async getDocsForWorker(rut, allDocs) {
            const cleanRut = (r) => String(r || "").replace(/[^0-9kK]/g, "").toUpperCase();
            const target = cleanRut(rut);
            return allDocs.filter(d => cleanRut(d.rut || d.workers?.rut) === target);
        }
    };

    console.log("[AFK API] Columna vertebral inicializada.");
})();
