import React from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { CakeDesigner, CreateTemplate, AuthGate } from '../src/index.js';

const supabase = createClient(
  'https://lsvmnycehfopxsgruwmk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxzdm1ueWNlaGZvcHhzZ3J1d21rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjI0NjIsImV4cCI6MjA5MTM5ODQ2Mn0.ay0o6ugWvik_Mp607oYyYQIQzX4wphhhLNi-53HvwHY'
);

const API_URL = 'https://spattoo-backend.onrender.com';

function createApiClient(supabaseClient) {
  async function authFetch(path, options = {}) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
    return res.json();
  }

  return {
    fetchElementTypes: () => authFetch('/api/element-types'),
    fetchElements: (opts = {}) => {
      const params = new URLSearchParams();
      if (opts.parentsOnly) params.set('parents_only', 'true');
      if (opts.elementTypeId) params.set('element_type_id', opts.elementTypeId);
      const qs = params.toString();
      return authFetch(`/api/elements${qs ? `?${qs}` : ''}`);
    },
    fetchTemplates: () => authFetch('/api/templates'),
    fetchTemplate: (id) => authFetch(`/api/templates/${id}`),
    fetchBakerProfile: () => authFetch('/api/baker/profile'),
    getSignedUploadUrl: (folder, filename, contentType) =>
      authFetch('/api/storage/sign-upload', {
        method: 'POST',
        body: JSON.stringify({ folder, filename, contentType }),
      }),
    signOut: () => supabaseClient.auth.signOut(),
    changePassword: (newPassword) => supabaseClient.auth.updateUser({ password: newPassword }),
  };
}

const apiClient = createApiClient(supabase);
const path = window.location.pathname;

function Root() {
  if (path === '/create-template') {
    return (
      <CreateTemplate
        supabase={supabase}
        onSaved={() => console.log('Template saved!')}
      />
    );
  }
  return (
    <CakeDesigner
      apiClient={apiClient}
      onOrder={({ design }) => console.log('Order:', design)}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate supabase={supabase}>
      <Root />
    </AuthGate>
  </React.StrictMode>
);
