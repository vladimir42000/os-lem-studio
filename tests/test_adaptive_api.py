from test_backend_simulation_response_regressions import make_client

REQUEST=dict(bounds=[dict(id='x',min=0,max=1,value=.5)],global_budget=24,local_budget=16,seed=17)

def test_job_lifecycle_validation_and_capacity():
    server,client=make_client()
    jobs=[]
    try:
        assert client.post('/api/optimise/adaptive/start',json={**REQUEST,'bounds':[]}).status_code==422
        for _ in range(4):
            r=client.post('/api/optimise/adaptive/start',json=REQUEST)
            assert r.status_code==200,r.text
            jobs.append(r.json()['job_id'])
        assert client.post('/api/optimise/adaptive/start',json=REQUEST).status_code==429
        step=client.post('/api/optimise/adaptive/step',json={'job_id':jobs[0]}).json()
        assert 'values' in step
        assert client.post('/api/optimise/adaptive/step',json={'job_id':jobs[0],'reply':{'token':step['token']+1,'score':0,'feasible':True}}).status_code==422
        assert client.post('/api/optimise/adaptive/stop',json={'job_id':jobs[0]}).status_code==200
        assert client.post('/api/optimise/adaptive/step',json={'job_id':jobs[0]}).status_code==404
    finally:
        for job_id in jobs:client.post('/api/optimise/adaptive/stop',json={'job_id':job_id})
        assert not server._adaptive_jobs
