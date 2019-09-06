module.exports = (sequelize, DataTypes) => {
	const turmaChange = sequelize.define(
		'aluno_turma_changelog', {
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
			alunoID: { type: DataTypes.INTEGER, field: 'aluno_id' },
			turmaOriginal: { type: DataTypes.INTEGER, field: 'turma_original_id' },
			turmaNova: { type: DataTypes.INTEGER, field: 'turma_nova_id' },
			modulo: { type: DataTypes.INTEGER, field: 'turma_modulo' },
			createdAt: { type: DataTypes.DATE, field: 'created_at' },
			updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
		},
		{
			freezeTableName: true,
		},
	);

	return turmaChange;
};
