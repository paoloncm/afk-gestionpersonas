// candidates.supabase.js
(async function() {
    const $ = s => document.querySelector(s);
    const getElements = () => ({
        btnNew: $('#btnNewCandidate'),
        modal: $('#candidateModal'),
        form: $('#candidateForm'),
        selectVac: $('#selectVacancy')
    });

    async function init() {
        if (!window.supabase) {
            setTimeout(init, 500);
            return;
        }
        loadFormVacancies();
    }

    async function loadFormVacancies() {
        const { selectVac } = getElements();
        if (!selectVac) return;

        const { data, error } = await supabase.from('vacancies').select('id, title').eq('status', 'Abierta');
        if (error) return console.error('Error cargando vacantes para modal:', error);
        
        selectVac.innerHTML = '<option value="">Ninguna por ahora</option>';
        data.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = v.title;
            selectVac.appendChild(opt);
        });
    }

    // Event delegation para abrir/cerrar
    document.addEventListener('click', (e) => {
        const { modal } = getElements();
        if (e.target.id === 'btnNewCandidate') {
            modal?.classList.add('is-open');
            loadFormVacancies(); // Recargar al abrir
        }
        if (e.target.classList.contains('close-modal') || e.target.classList.contains('modal')) {
            modal?.classList.remove('is-open');
        }
    });

    // Form submit listener
    document.addEventListener('submit', async (e) => {
        if (e.target.id !== 'candidateForm') return;
        e.preventDefault();
        
        const { modal, form } = getElements();
        const formData = new FormData(form);
            const cvFile = formData.get('cv_file');
            let cvUrl = null;

            if (cvFile && cvFile.size > 0) {
                console.log('📤 Subiendo CV...', cvFile.name);
                const fileName = `${Date.now()}_${cvFile.name.replace(/\s+/g, '_')}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('cvs')
                    .upload(`public/${fileName}`, cvFile);

                if (uploadError) {
                    console.error('❌ Error subiendo CV:', uploadError);
                    alert('Error al subir el CV: ' + uploadError.message + '. El candidato se guardará sin archivo.');
                } else {
                    const { data: publicUrlData } = supabase.storage
                        .from('cvs')
                        .getPublicUrl(`public/${fileName}`);
                    cvUrl = publicUrlData.publicUrl;
                    console.log('✅ CV subido con éxito:', cvUrl);
                }
            }

            const newCandidate = {
                nombre_completo: formData.get('nombre_completo'),
                profesion: formData.get('profesion'),
                correo: formData.get('correo'),
                telefono: formData.get('telefono'),
                nota: parseFloat(formData.get('nota')),
                vacancy_id: formData.get('vacancy_id') || null,
                cv_url: cvUrl,
                status: 'Postulado'
            };

            const { data, error } = await supabase
                .from('candidates')
                .insert([newCandidate])
                .select();

            if (error) {
                alert('Error al guardar candidato: ' + error.message);
            } else {
                // Log the creation
                if (data && data.length > 0) {
                    const cid = data[0].id;
                    await supabase.from('candidate_history').insert([{
                        candidate_id: cid,
                        event_type: 'status_change',
                        old_value: 'N/A (Creación)',
                        new_value: 'Postulado'
                    }]);
                    
                    if (newCandidate.vacancy_id) {
                        await supabase.from('candidate_history').insert([{
                            candidate_id: cid,
                            event_type: 'vacancy_link',
                            old_value: 'Ninguna',
                            new_value: newCandidate.vacancy_id
                        }]);
                    }
                    
                    if (cvUrl) {
                        await supabase.from('candidate_history').insert([{
                            candidate_id: cid,
                            event_type: 'document_uploaded',
                            old_value: 'Ninguno',
                            new_value: 'CV cargado'
                        }]);
                    }
                }

                if (modal) modal.classList.remove('is-open');
                if (form) form.reset();
                if (window.loadFromSupabase) window.loadFromSupabase(); // Refrescar tabla si existe
                if (window.loadCandidates) window.loadCandidates();     // Refrescar pagina candidatos si existe
                alert('Candidato registrado con éxito en el pipeline');
            }
    });

    init();
})();