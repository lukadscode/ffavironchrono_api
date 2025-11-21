/**
 * Exemple de composant React pour la page "Arbitres" du backoffice
 * 
 * Cette page affiche :
 * - La liste des courses avec le statut "non_official"
 * - Les résultats d'une course sélectionnée
 * - Un bouton pour valider une course (passer de "non_official" à "official")
 * 
 * Routes API utilisées :
 * - GET /races/non-official : Liste des courses non officielles
 * - GET /races/results/:race_id : Résultats d'une course
 * - PUT /races/:id : Mise à jour du statut d'une course
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3010';

const ArbitresPage = () => {
  const [races, setRaces] = useState([]);
  const [selectedRace, setSelectedRace] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Récupérer la liste des courses non officielles
  useEffect(() => {
    fetchNonOfficialRaces();
  }, []);

  const fetchNonOfficialRaces = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token'); // Récupérer le token d'authentification
      const response = await axios.get(`${API_BASE_URL}/races/non-official`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.data.status === 'success') {
        setRaces(response.data.data);
      }
    } catch (err) {
      setError('Erreur lors du chargement des courses');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Récupérer les résultats d'une course
  const fetchRaceResults = async (raceId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/races/results/${raceId}`);
      if (response.data.status === 'success') {
        setResults(response.data.data);
      }
    } catch (err) {
      setError('Erreur lors du chargement des résultats');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Valider une course (passer de non_official à official)
  const validateRace = async (raceId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_BASE_URL}/races/${raceId}`,
        { status: 'official' },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.data.status === 'success') {
        // Retirer la course de la liste
        setRaces(races.filter((race) => race.id !== raceId));
        // Si c'était la course sélectionnée, la désélectionner
        if (selectedRace?.id === raceId) {
          setSelectedRace(null);
          setResults([]);
        }
        alert('Course validée avec succès !');
      }
    } catch (err) {
      setError('Erreur lors de la validation de la course');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Gérer le clic sur une course
  const handleRaceClick = (race) => {
    setSelectedRace(race);
    fetchRaceResults(race.id);
  };

  // Formater le temps en millisecondes en format MM:SS.mmm
  const formatTime = (ms) => {
    if (!ms) return '-';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Page Arbitres - Validation des Courses</h1>
      
      {error && (
        <div style={{ color: 'red', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Liste des courses non officielles */}
        <div style={{ flex: 1 }}>
          <h2>Courses en attente de validation ({races.length})</h2>
          {loading && <p>Chargement...</p>}
          {!loading && races.length === 0 && (
            <p>Aucune course en attente de validation</p>
          )}
          {!loading && races.length > 0 && (
            <div style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '10px' }}>
              {races.map((race) => (
                <div
                  key={race.id}
                  onClick={() => handleRaceClick(race)}
                  style={{
                    padding: '10px',
                    marginBottom: '10px',
                    border: selectedRace?.id === race.id ? '2px solid blue' : '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    backgroundColor: selectedRace?.id === race.id ? '#e3f2fd' : 'white',
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>
                    Course #{race.race_number} - {race.name || 'Sans nom'}
                  </div>
                  <div style={{ fontSize: '0.9em', color: '#666' }}>
                    {race.race_phase?.event?.name || 'Événement inconnu'}
                  </div>
                  <div style={{ fontSize: '0.9em', color: '#666' }}>
                    Phase: {race.race_phase?.name || 'Phase inconnue'}
                  </div>
                  {race.Distance && (
                    <div style={{ fontSize: '0.9em', color: '#666' }}>
                      Distance: {race.Distance.value}m
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Résultats de la course sélectionnée */}
        <div style={{ flex: 1 }}>
          {selectedRace ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Résultats - Course #{selectedRace.race_number}</h2>
                <button
                  onClick={() => validateRace(selectedRace.id)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px',
                  }}
                >
                  Valider la course
                </button>
              </div>
              
              {loading && <p>Chargement des résultats...</p>}
              {!loading && results.length === 0 && (
                <p>Aucun résultat disponible pour cette course</p>
              )}
              {!loading && results.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                      <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Position</th>
                      <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Voie</th>
                      <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Club</th>
                      <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Catégorie</th>
                      <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Temps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) => (
                      <tr key={index} style={{ backgroundColor: result.has_timing ? 'white' : '#ffebee' }}>
                        <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                          {result.position || '-'}
                        </td>
                        <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                          {result.lane}
                        </td>
                        <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                          {result.club_name || '-'} ({result.club_code || '-'})
                        </td>
                        <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                          {result.category?.label || '-'}
                        </td>
                        <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                          {result.final_time ? formatTime(parseInt(result.final_time)) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
              Sélectionnez une course pour voir ses résultats
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArbitresPage;

