'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import LandingEditor from '@/components/landings/LandingEditor';

export default function EditorPage() {
  const params = useParams();
  const id = params?.id as string;

  return <LandingEditor landingId={id} />;
}
