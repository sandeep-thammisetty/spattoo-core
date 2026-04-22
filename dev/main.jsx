import React from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { CakeDesigner, CreateTemplate, AuthGate } from '../src/index.js';

const supabase = createClient(
  'https://lsvmnycehfopxsgruwmk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxzdm1ueWNlaGZvcHhzZ3J1d21rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjI0NjIsImV4cCI6MjA5MTM5ODQ2Mn0.ay0o6ugWvik_Mp607oYyYQIQzX4wphhhLNi-53HvwHY'
);

const STORAGE_BASE = 'https://lsvmnycehfopxsgruwmk.supabase.co/storage/v1/object/public/cake-assets';

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
      supabase={supabase}
      storageBaseUrl={STORAGE_BASE}
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
